import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePage, Link } from '@inertiajs/react'
import {
    PieChart, Plus, Building2, CheckCircle2, Clock, X, AlertTriangle, ChevronDown,
    Pencil, Check, Search, Wallet, Loader2, CircleDashed, Info,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { PageHeader, StatCard, Panel, EmptyState, Select, RefreshButton, StatSkeletons, Skeleton } from '../../Components/Insights/Kit'
import { useToast } from '../../Components/Toast'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../lib/utils'
import { currency, term } from '../../lib/terms'
import { programmes, programmeLabel, programmeColor } from '../../lib/programmes'
import api from '../../lib/api'
import ProposalHover from '../../Components/Finance/ProposalHover'
import DownloadMenu from '../../Components/Finance/DownloadMenu'
import ClearButton from '../../Components/Finance/ClearButton'

const STATUS = {
    approved:      { label: 'Approved',      cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 },
    pending:       { label: 'Pending',       cls: 'bg-amber-50 text-amber-700 ring-amber-200',       icon: Clock },
    not_allocated: { label: 'Not allocated', cls: 'bg-gray-100 text-gray-600 ring-gray-200',         icon: CircleDashed },
}

const statusOf = (p) => p.budget_allocations?.[0]?.status ?? 'not_allocated'
const allocationOf = (p) => p.budget_allocations?.[0] ?? null
const awarded = (p) => parseFloat(p.award?.awarded_amount ?? 0)

function StatusBadge({ status }) {
    const cfg = STATUS[status] ?? STATUS.not_allocated
    const Icon = cfg.icon
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cfg.cls}`}>
            <Icon size={11} /> {cfg.label}
        </span>
    )
}

function ProgrammeChip({ category }) {
    const color = programmeColor(category)
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}14`, color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {programmeLabel(category)}
        </span>
    )
}

function Dialog({ title, subtitle, icon: Icon, onClose, children, footer }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Icon size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                            {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="space-y-4 px-6 py-5">{children}</div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>
            </div>
        </div>
    )
}

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:text-sm'

function AllocateDialog({ proposal, fiscalYears, defaultYear, onClose, onDone }) {
    const { error } = useToast()
    const [year, setYear] = useState(defaultYear || fiscalYears[0] || '')
    const [saving, setSaving] = useState(false)

    const submit = async () => {
        if (!year.trim()) return error('Enter a fiscal year.')
        setSaving(true)
        try {
            await api.post(`/proposals/${proposal.id}/quick-allocate`, { fiscal_year: year.trim() })
            onDone('Allocation created — it now waits for approval.')
        } catch (e) {
            error(e.response?.data?.message ?? 'The allocation could not be created.')
        }
        setSaving(false)
    }

    return (
        <Dialog title="Allocate budget" subtitle={`${proposal.tracker_number} · ${proposal.title}`} icon={Wallet} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {saving && <Loader2 size={14} className="animate-spin" />} Create allocation
                </button>
            </>}>
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-700">Amount to allocate</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-900">{formatCurrency(awarded(proposal))}</p>
                <p className="mt-0.5 text-xs text-emerald-700">The full awarded amount. It becomes available to the team once approved.</p>
            </div>
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Fiscal year</span>
                <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2026-2027" list="fy-options" className={inputCls} />
                <datalist id="fy-options">{fiscalYears.map((y) => <option key={y} value={y} />)}</datalist>
            </label>
        </Dialog>
    )
}

function EditDialog({ allocation, proposal, onClose, onDone }) {
    const { error } = useToast()
    const [amount, setAmount] = useState(String(allocation.total_amount ?? ''))
    const [notes, setNotes] = useState(allocation.notes ?? '')
    const [saving, setSaving] = useState(false)
    const isApproved = allocation.status === 'approved'

    const submit = async () => {
        if (!isApproved && (!amount || Number(amount) <= 0)) return error('Enter a valid amount.')
        setSaving(true)
        try {
            await api.patch(`/budget-allocations/${allocation.id}`, { amount: isApproved ? undefined : Number(amount), notes: notes || null })
            onDone('Allocation updated.')
        } catch (e) {
            error(e.response?.data?.message ?? 'The allocation could not be updated.')
        }
        setSaving(false)
    }

    return (
        <Dialog title="Edit allocation" subtitle={`${proposal.tracker_number} · ${proposal.title}`} icon={Pencil} onClose={onClose}
            footer={<>
                <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submit} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {saving && <Loader2 size={14} className="animate-spin" />} Save
                </button>
            </>}>
            {isApproved ? (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    <Info size={14} className="mt-0.5 shrink-0" /> An approved allocation keeps its amount; only the notes can change.
                </p>
            ) : (
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Amount ({currency()})</span>
                    <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} tabular-nums`} />
                    <span className="mt-1 block text-xs text-gray-500">Awarded: {formatCurrency(awarded(proposal))}</span>
                </label>
            )}
            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Notes</span>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
            </label>
        </Dialog>
    )
}

/** Approved / pending / not-yet-allocated as shares of the awarded total. */
function CoverageBar({ approved, pending, total }) {
    const pct = (n) => (total > 0 ? Math.min(100, (n / total) * 100) : 0)
    const rest = Math.max(0, total - approved - pending)
    const parts = [
        { label: 'Approved', value: approved, cls: 'bg-emerald-500', dot: 'bg-emerald-500' },
        { label: 'Pending approval', value: pending, cls: 'bg-amber-400', dot: 'bg-amber-400' },
        { label: 'Not allocated', value: rest, cls: 'bg-gray-200', dot: 'bg-gray-300' },
    ]
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">Allocation coverage</p>
                <p className="text-sm tabular-nums text-gray-500"><span className="font-bold text-gray-900">{Math.round(pct(approved))}%</span> of the awarded budget is approved</p>
            </div>
            <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-gray-100">
                {parts.map((p) => p.value > 0 && <div key={p.label} className={`${p.cls} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${pct(p.value)}%` }} title={`${p.label}: ${formatCurrency(p.value)}`} />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
                {parts.map((p) => (
                    <span key={p.label} className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${p.dot}`} /> {p.label} <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(p.value)}</span>
                    </span>
                ))}
            </div>
        </div>
    )
}

function ProposalRow({ proposal, canAllocate, canApprove, selected, onToggle, onAllocate, onApprove, onEdit, busy }) {
    const allocation = allocationOf(proposal)
    const status = statusOf(proposal)
    const allocatedDiffers = allocation && parseFloat(allocation.total_amount) !== awarded(proposal)
    const selectable = status === 'pending' && canApprove

    return (
        <li className={`flex flex-col gap-3 px-4 py-3.5 transition-colors sm:flex-row sm:items-center ${selected ? 'bg-emerald-50/60' : 'hover:bg-gray-50/70'}`}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex w-4 shrink-0 justify-center pt-1">
                    {selectable && (
                        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${proposal.tracker_number}`}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    )}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <ProposalHover id={proposal.id}><Link href={`/proposals/${proposal.id}`} className="font-mono text-xs font-bold text-indigo-600">{proposal.tracker_number}</Link></ProposalHover>
                        <ProgrammeChip category={proposal.category} />
                        <StatusBadge status={status} />
                        {allocation?.fiscal_year && <span className="text-[11px] text-gray-400">FY {allocation.fiscal_year}</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900 sm:line-clamp-1"><ProposalHover id={proposal.id}>{proposal.title}</ProposalHover></p>
                    <p className="mt-0.5 text-xs text-gray-500">
                        {proposal.pi?.name}
                        {status === 'approved' && allocation?.approved_by?.name && <> · approved by {allocation.approved_by.name}</>}
                        {status === 'pending' && allocation?.allocated_by?.name && <> · allocated by {allocation.allocated_by.name}</>}
                    </p>
                    {allocation?.notes && <p className="mt-1 text-xs italic text-gray-400">“{allocation.notes}”</p>}
                </div>
            </div>

            <div className="flex items-center justify-between gap-4 pl-7 sm:justify-end sm:pl-0">
                <div className="text-left sm:text-right">
                    <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(awarded(proposal))}</p>
                    <p className="text-[11px] text-gray-400">{allocatedDiffers ? <span className="font-semibold text-indigo-600">allocated {formatCurrency(allocation.total_amount)}</span> : 'awarded'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {status === 'not_allocated' && canAllocate && (
                        <button onClick={onAllocate} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                            <Plus size={12} /> Allocate
                        </button>
                    )}
                    {status === 'pending' && canApprove && (
                        <button onClick={onApprove} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                        </button>
                    )}
                    {allocation && canAllocate && (
                        <button onClick={onEdit} aria-label={`Edit allocation for ${proposal.tracker_number}`} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50">
                            <Pencil size={13} />
                        </button>
                    )}
                </div>
            </div>
        </li>
    )
}

export default function BudgetAllocations() {
    const { success, error } = useToast()
    const { hasPermission, covers, accessScope } = useAuth()
    const currentYear = usePage().props.app_settings?.current_academic_year ?? ''

    const [proposals, setProposals] = useState(null)
    const [fiscalYears, setFiscalYears] = useState([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(new Set())
    const [busy, setBusy] = useState(null)
    const [collapsed, setCollapsed] = useState(new Set())

    const [year, setYear] = useState(currentYear)
    const [college, setCollege] = useState('')
    const [programme, setProgramme] = useState('')
    const [tab, setTab] = useState('all')
    const [search, setSearch] = useState('')

    const [allocating, setAllocating] = useState(null)
    const [editing, setEditing] = useState(null)

    const canAllocate = (p) => hasPermission('budget_allocations.create') && covers(p.college_id, p.category)
    // Approval is for the central office and programme directors, never the college.
    const canApprove = (p) => hasPermission('budget_allocations.approve')
        && (accessScope.type === 'all' || (accessScope.type === 'category' && (accessScope.categories ?? []).includes(p.category)))

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [pRes, yRes] = await Promise.all([
                api.get('/budget-allocations/proposal-budgets'),
                api.get('/budget-allocations/fiscal-years'),
            ])
            setProposals(pRes.data?.data ?? [])
            setFiscalYears(yRes.data?.data ?? [])
        } catch {
            setProposals([])
            error('Could not load budget allocations.')
        }
        setLoading(false)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load() }, [load])

    const all = proposals ?? []
    const years = useMemo(() => [...new Set([currentYear, ...all.map((p) => p.academic_year)].filter(Boolean))].sort().reverse(), [all, currentYear])
    const colleges = useMemo(() => [...new Map(all.filter((p) => p.college).map((p) => [p.college.id, p.college.name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [all])

    // Year, college, programme and search narrow the figures; the tab only narrows the list.
    const scoped = useMemo(() => {
        const q = search.trim().toLowerCase()
        return all.filter((p) => (!year || p.academic_year === year)
            && (!college || p.college_id === college)
            && (!programme || p.category === programme)
            && (!q || [p.tracker_number, p.title, p.pi?.name].some((v) => v?.toLowerCase().includes(q))))
    }, [all, year, college, programme, search])

    const needsMe = (p) => statusOf(p) === 'pending' && canApprove(p)
    const tabs = [
        { key: 'all', label: 'All', match: () => true },
        { key: 'mine', label: 'Needs my approval', match: needsMe },
        { key: 'pending', label: 'Pending', match: (p) => statusOf(p) === 'pending' },
        { key: 'approved', label: 'Approved', match: (p) => statusOf(p) === 'approved' },
        { key: 'not_allocated', label: 'Not allocated', match: (p) => statusOf(p) === 'not_allocated' },
    ]
    const visible = scoped.filter(tabs.find((t) => t.key === tab).match)

    const totals = useMemo(() => {
        const t = { awarded: 0, approved: 0, pending: 0, pendingCount: 0, unallocated: 0, unallocatedSum: 0, colleges: new Set() }
        scoped.forEach((p) => {
            const a = allocationOf(p)
            t.awarded += awarded(p)
            if (p.college_id) t.colleges.add(p.college_id)
            if (a?.status === 'approved') t.approved += parseFloat(a.total_amount ?? 0)
            else if (a?.status === 'pending') { t.pending += parseFloat(a.total_amount ?? 0); t.pendingCount += 1 }
            else { t.unallocated += 1; t.unallocatedSum += awarded(p) }
        })
        return t
    }, [scoped])

    const byCollege = useMemo(() => {
        const groups = new Map()
        visible.forEach((p) => {
            const key = p.college?.name ?? 'No college'
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key).push(p)
        })
        return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    }, [visible])

    const approvable = visible.filter(needsMe).map((p) => allocationOf(p).id)
    const allSelected = approvable.length > 0 && approvable.every((id) => selected.has(id))

    const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    const setMany = (ids, on) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n })
    const resetSelection = () => setSelected(new Set())

    const approveOne = async (id) => {
        setBusy(id)
        try {
            await api.post(`/budget-allocations/${id}/approve`)
            success('Allocation approved.')
            load()
        } catch (e) {
            error(e.response?.data?.message ?? 'The allocation could not be approved.')
        }
        setBusy(null)
    }

    const approveMany = async (ids) => {
        if (!ids.length) return
        setBusy('bulk')
        try {
            const res = await api.post('/budget-allocations/bulk-approve', { ids })
            success(res.data?.message ?? 'Allocations approved.')
            resetSelection()
            load()
        } catch (e) {
            error(e.response?.data?.message ?? 'The allocations could not be approved.')
        }
        setBusy(null)
    }

    const exportColumns = [
        { label: 'Tracker', value: (p) => p.tracker_number },
        { label: 'Title', value: (p) => p.title },
        { label: 'PI', value: (p) => p.pi?.name },
        { label: term('college'), value: (p) => p.college?.name },
        { label: 'Programme', value: (p) => programmeLabel(p.category) },
        { label: 'Academic year', value: (p) => p.academic_year },
        { label: 'Awarded', value: (p) => awarded(p) },
        { label: 'Allocated', value: (p) => (allocationOf(p) ? parseFloat(allocationOf(p).total_amount) : '') },
        { label: 'Status', value: (p) => STATUS[statusOf(p)].label },
        { label: 'Fiscal year', value: (p) => allocationOf(p)?.fiscal_year },
    ]
    const filtersOn = !!(search || college || programme || year !== currentYear || tab !== 'all')
    const clearFilters = () => { setSearch(''); setCollege(''); setProgramme(''); setYear(currentYear); setTab('all'); resetSelection() }

    const done = (message) => { setAllocating(null); setEditing(null); success(message); load() }
    const showCollege = accessScope.type !== 'college' && colleges.length > 1

    return (
        <AppLayout breadcrumb="Budget Allocations">
            <div className="mx-auto max-w-6xl space-y-5">
                <PageHeader icon={PieChart} color="emerald" title="Budget Allocations"
                    description="Turn awards into approved budgets. A team can request funds once its allocation is approved.">
                    <DownloadMenu filename="budget-allocations" title="Budget allocations" subtitle={[year || 'All years', tabs.find((t) => t.key === tab)?.label].join(' · ')} columns={exportColumns} rows={visible} />
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {proposals === null ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={Wallet} color="indigo" label="Total awarded" value={formatCurrency(totals.awarded)}
                            hint={`${scoped.length} project${scoped.length === 1 ? '' : 's'} · ${totals.colleges.size} ${term('college', { plural: totals.colleges.size !== 1, lower: true })}`} />
                        <StatCard icon={CheckCircle2} color="emerald" label="Approved" value={formatCurrency(totals.approved)}
                            hint={totals.awarded ? `${Math.round((totals.approved / totals.awarded) * 100)}% of awarded` : '—'} />
                        <StatCard icon={Clock} color="amber" label="Pending approval" value={formatCurrency(totals.pending)}
                            hint={`${totals.pendingCount} allocation${totals.pendingCount === 1 ? '' : 's'}`} hintTone={totals.pendingCount ? 'text-amber-600 font-medium' : undefined} />
                        <StatCard icon={CircleDashed} color="slate" label="Not yet allocated" value={totals.unallocated}
                            hint={totals.unallocated ? `${formatCurrency(totals.unallocatedSum)} awarded` : 'Everything is allocated'} />
                    </div>
                )}

                {proposals !== null && totals.awarded > 0 && <CoverageBar approved={totals.approved} pending={totals.pending} total={totals.awarded} />}

                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex flex-col gap-2 lg:flex-row">
                        <label className="relative min-w-0 flex-1">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={(e) => { setSearch(e.target.value); resetSelection() }} placeholder="Search tracker number, title or PI…"
                                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:text-sm" />
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            <Select label="Academic year" value={year} onChange={(v) => { setYear(v); resetSelection() }} className="sm:w-40">
                                <option value="">All years</option>
                                {years.map((y) => <option key={y} value={y}>{y}</option>)}
                            </Select>
                            {programmes({ includeInactive: true }).length > 1 && (
                                <Select label="Programme" value={programme} onChange={(v) => { setProgramme(v); resetSelection() }} className="sm:w-48">
                                    <option value="">All programmes</option>
                                    {programmes({ includeInactive: true }).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                                </Select>
                            )}
                            {showCollege && (
                                <Select label={term('college')} value={college} onChange={(v) => { setCollege(v); resetSelection() }} className="col-span-2 sm:w-52">
                                    <option value="">All {term('college', { plural: true, lower: true })}</option>
                                    {colleges.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                                </Select>
                            )}
                            {filtersOn && <ClearButton onClick={clearFilters} />}
                        </div>
                    </div>
                    <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
                        {tabs.map((t) => {
                            const count = scoped.filter(t.match).length
                            if (t.key === 'mine' && !hasPermission('budget_allocations.approve')) return null
                            return (
                                <button key={t.key} onClick={() => { setTab(t.key); resetSelection() }}
                                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                    {t.label}
                                    <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === t.key ? 'bg-white/20' : t.key === 'mine' && count ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {loading && proposals === null ? (
                    <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
                ) : visible.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={PieChart}
                            title={all.length === 0 ? 'No funded projects yet' : 'Nothing matches these filters'}
                            text={all.length === 0 ? 'Projects appear here once they are funded and have an award.' : 'Try another year, programme or tab.'} />
                    </Panel>
                ) : (
                    <div className="space-y-4">
                        {approvable.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-2.5">
                                <p className="flex items-center gap-2 text-sm text-amber-900">
                                    <AlertTriangle size={15} className="shrink-0 text-amber-500" />
                                    <span><span className="font-semibold">{approvable.length}</span> allocation{approvable.length === 1 ? '' : 's'} here wait{approvable.length === 1 ? 's' : ''} for your approval.</span>
                                </p>
                                <button onClick={() => setMany(approvable, !allSelected)} className="text-sm font-semibold text-amber-800 hover:underline">
                                    {allSelected ? 'Clear selection' : 'Select all'}
                                </button>
                            </div>
                        )}

                        {byCollege.map(([name, rows]) => {
                            const groupAwarded = rows.reduce((s, p) => s + awarded(p), 0)
                            const groupApprovable = rows.filter(needsMe).map((p) => allocationOf(p).id)
                            const groupApproved = rows.filter((p) => statusOf(p) === 'approved').length
                            const isCollapsed = collapsed.has(name)
                            return (
                                <section key={name} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                                        <button onClick={() => setCollapsed((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })}
                                            className="flex min-w-0 items-center gap-3 text-left">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200"><Building2 size={16} /></span>
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold text-gray-900">{name}</span>
                                                <span className="block text-xs text-gray-500">
                                                    <span className="font-semibold tabular-nums text-gray-700">{formatCurrency(groupAwarded)}</span> · {rows.length} project{rows.length === 1 ? '' : 's'} · {groupApproved} approved
                                                </span>
                                            </span>
                                            <ChevronDown size={16} className={`shrink-0 text-gray-400 transition ${isCollapsed ? '-rotate-90' : ''}`} />
                                        </button>
                                        {groupApprovable.length > 0 && (
                                            <button onClick={() => approveMany(groupApprovable)} disabled={busy === 'bulk'}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                                                <Check size={12} /> Approve all ({groupApprovable.length})
                                            </button>
                                        )}
                                    </div>
                                    {!isCollapsed && (
                                        <ul className="divide-y divide-gray-100">
                                            {rows.map((p) => {
                                                const a = allocationOf(p)
                                                return (
                                                    <ProposalRow key={p.id} proposal={p}
                                                        canAllocate={canAllocate(p)} canApprove={canApprove(p)}
                                                        selected={!!a && selected.has(a.id)} onToggle={() => toggle(a.id)}
                                                        onAllocate={() => setAllocating(p)} onApprove={() => approveOne(a.id)}
                                                        onEdit={() => setEditing({ allocation: a, proposal: p })} busy={busy === a?.id} />
                                                )
                                            })}
                                        </ul>
                                    )}
                                </section>
                            )
                        })}
                    </div>
                )}

                {selected.size > 0 && (
                    <div className="sticky bottom-3 z-30 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                        <p className="text-sm text-gray-700"><span className="font-bold">{selected.size}</span> selected</p>
                        <div className="flex gap-2">
                            <button onClick={resetSelection} className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Clear</button>
                            <button onClick={() => approveMany([...selected])} disabled={busy === 'bulk'}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                {busy === 'bulk' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve {selected.size}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {allocating && <AllocateDialog proposal={allocating} fiscalYears={fiscalYears} defaultYear={currentYear} onClose={() => setAllocating(null)} onDone={done} />}
            {editing && <EditDialog allocation={editing.allocation} proposal={editing.proposal} onClose={() => setEditing(null)} onDone={done} />}
        </AppLayout>
    )
}
