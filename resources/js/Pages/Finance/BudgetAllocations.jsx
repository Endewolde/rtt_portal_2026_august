import { useState, useEffect, useCallback } from 'react'
import {
    PieChart, Plus, Building2, FileText, CheckCircle2,
    Clock, X, AlertTriangle, ChevronDown, Edit2, Check,
    Filter,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import { formatCurrency } from '../../lib/utils'
import api from '../../lib/api'
import { usePage } from '@inertiajs/react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUser() {
    try { return JSON.parse(localStorage.getItem('rtt_user') || '{}') } catch { return {} }
}
function getRoles(user) {
    return (user.roles || []).map(r => (typeof r === 'string' ? r : r.name))
}

/** True if this user's role allows approving proposals in this category. */
function canApproveCategory(roles, category) {
    if (roles.some(r => ['super_admin', 'admin', 'central_officer'].includes(r))) return true
    if (roles.includes('research_officer')   && category === 'research')              return true
    if (roles.includes('community_officer')  && category === 'community_engagement')  return true
    if (roles.includes('technology_officer') && category === 'technology_transfer')   return true
    return false
}

const CATEGORY_LABEL = {
    research:              'Research',
    community_engagement:  'Community',
    technology_transfer:   'Technology',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
    approved:      { label: 'Approved',     color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    pending:       { label: 'Pending',       color: 'bg-amber-100 text-amber-700', icon: Clock },
    not_allocated: { label: 'Not Allocated', color: 'bg-gray-100 text-gray-500',  icon: AlertTriangle },
}

function AllocationBadge({ status }) {
    const cfg  = STATUS_CFG[status] ?? STATUS_CFG.not_allocated
    const Icon = cfg.icon
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
            <Icon size={10} />{cfg.label}
        </span>
    )
}

// ─── Fiscal year prompt ───────────────────────────────────────────────────────

function FiscalYearModal({ proposal, fiscalYears, defaultYear, onClose, onSuccess }) {
    const { error } = useToast()
    const [year,   setYear]   = useState(defaultYear || fiscalYears[0] || '')
    const [saving, setSaving] = useState(false)

    const submit = async () => {
        if (!year) return error('Enter a fiscal year.')
        setSaving(true)
        try {
            await api.post(`/proposals/${proposal.id}/quick-allocate`, { fiscal_year: year })
            onSuccess()
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to allocate.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                <div className="bg-linear-to-r from-indigo-600 to-purple-600 rounded-t-2xl px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-white">Allocate Budget</h2>
                        <p className="text-indigo-100 text-xs mt-0.5">{proposal.tracker_number} · {formatCurrency(proposal.award?.awarded_amount ?? 0)}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={14} /></button>
                </div>
                <div className="p-5 space-y-3">
                    <p className="text-xs text-gray-500">This allocates the full awarded amount ({formatCurrency(proposal.award?.awarded_amount ?? 0)}) as a pending allocation. An approving officer will need to approve it before the PI can submit budget requests.</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year *</label>
                        <input type="text" value={year} onChange={e => setYear(e.target.value)}
                            placeholder="e.g. 2026-2027" list="fy-list-modal"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <datalist id="fy-list-modal">
                            {fiscalYears.map(y => <option key={y} value={y} />)}
                        </datalist>
                    </div>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                        {saving ? 'Creating…' : 'Create Allocation'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Edit allocation modal ─────────────────────────────────────────────────────

function EditAllocationModal({ allocation, onClose, onSuccess }) {
    const { error } = useToast()
    const [amount, setAmount] = useState(String(allocation.total_amount ?? ''))
    const [notes,  setNotes]  = useState(allocation.notes ?? '')
    const [saving, setSaving] = useState(false)
    const isApproved = allocation.status === 'approved'

    const submit = async () => {
        if (!isApproved && (!amount || Number(amount) <= 0)) return error('Enter a valid amount.')
        setSaving(true)
        try {
            await api.patch(`/budget-allocations/${allocation.id}`, {
                amount: isApproved ? undefined : Number(amount),
                notes:  notes || null,
            })
            onSuccess()
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to update allocation.')
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-t-2xl px-6 py-4 flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">Edit Allocation</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X size={14} /></button>
                </div>
                <div className="p-5 space-y-3">
                    {!isApproved && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ETB) *</label>
                            <input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    )}
                    {isApproved && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            Amount cannot be changed on an approved allocation. You can update notes only.
                        </p>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Proposal budget row ───────────────────────────────────────────────────────

function ProposalBudgetRow({ proposal, roles, canAllocate, selectedIds, onSelect, onAllocate, onApprove, onEdit }) {
    const award       = proposal.award
    const allocation  = proposal.budget_allocations?.[0] ?? null
    const allocStatus = allocation ? allocation.status : 'not_allocated'
    const awardedAmt  = parseFloat(award?.awarded_amount ?? 0)
    const userCanApproveThis = canApproveCategory(roles, proposal.category)

    const isPending  = allocStatus === 'pending'
    const isApproved = allocStatus === 'approved'
    const isNone     = allocStatus === 'not_allocated'
    const isSelectable = isPending && userCanApproveThis

    return (
        <div className={`bg-white border rounded-xl px-4 py-3 transition-all ${
            isPending  ? 'border-amber-200 bg-amber-50/30' :
            isApproved ? 'border-green-200 bg-green-50/20' :
            'border-gray-200'
        }`}>
            <div className="flex flex-wrap items-start gap-3">
                {/* Checkbox */}
                <div className="flex items-center mt-1 shrink-0 w-4">
                    {isSelectable ? (
                        <input type="checkbox" checked={selectedIds.has(allocation.id)}
                            onChange={() => onSelect(allocation.id)}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    ) : (
                        <span className="w-4 h-4" />
                    )}
                </div>

                {/* Proposal info */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold text-indigo-600">{proposal.tracker_number}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                            {CATEGORY_LABEL[proposal.category] ?? proposal.category}
                        </span>
                        <AllocationBadge status={allocStatus} />
                        {allocation?.fiscal_year && (
                            <span className="text-xs text-gray-400">FY {allocation.fiscal_year}</span>
                        )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{proposal.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        PI: {proposal.pi?.name}
                        {isApproved && allocation?.approvedBy && (
                            <> · Approved by <strong>{allocation.approvedBy.name}</strong></>
                        )}
                        {isPending && allocation?.allocatedBy && (
                            <> · Allocated by {allocation.allocatedBy.name}</>
                        )}
                    </p>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(awardedAmt)}</p>
                    <p className="text-xs text-gray-400">awarded</p>
                    {allocation && parseFloat(allocation.total_amount) !== awardedAmt && (
                        <p className="text-xs text-indigo-600 font-semibold">
                            Alloc: {formatCurrency(allocation.total_amount)}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {isNone && canAllocate && canApproveCategory(roles, proposal.category) && (
                        <button onClick={() => onAllocate(proposal)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">
                            <Plus size={11} /> Allocate
                        </button>
                    )}
                    {isPending && userCanApproveThis && (
                        <button onClick={() => onApprove(allocation.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                            <Check size={11} /> Approve
                        </button>
                    )}
                    {allocation && canAllocate && canApproveCategory(roles, proposal.category) && (
                        <button onClick={() => onEdit(allocation)}
                            className="p-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50">
                            <Edit2 size={12} />
                        </button>
                    )}
                </div>
            </div>

            {allocation?.notes && (
                <p className="text-xs text-gray-400 italic mt-1.5 pl-7">{allocation.notes}</p>
            )}
        </div>
    )
}

// ─── College section ───────────────────────────────────────────────────────────

function CollegeSection({ collegeName, proposals, roles, canAllocate, selectedIds, onSelect, onSelectAll, onAllocate, onApprove, onBulkApproveCollege, onEdit }) {
    const pending    = proposals.filter(p => {
        const alloc = p.budget_allocations?.[0]
        return alloc?.status === 'pending' && canApproveCategory(roles, p.category)
    })
    const approved   = proposals.filter(p => p.budget_allocations?.[0]?.status === 'approved').length
    const unalloc    = proposals.filter(p => !p.budget_allocations?.length).length
    const totalBudget = proposals.reduce((s, p) => s + parseFloat(p.award?.awarded_amount ?? 0), 0)
    const pendingIds = pending.map(p => p.budget_allocations[0].id)
    const allSelected = pendingIds.length > 0 && pendingIds.every(id => selectedIds.has(id))

    return (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* College header */}
            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {/* Select all pending in this college */}
                    {pending.length > 0 && (
                        <input type="checkbox" checked={allSelected}
                            onChange={() => onSelectAll(pendingIds, !allSelected)}
                            className="w-4 h-4 rounded border-indigo-300 text-green-600 focus:ring-green-500"
                            title="Select all pending" />
                    )}
                    <Building2 size={16} className="text-indigo-600 shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-900 text-sm">{collegeName}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span>Total: <strong>{formatCurrency(totalBudget)}</strong></span>
                            <span className="text-green-600">{approved} approved</span>
                            {pending.length > 0 && <span className="text-amber-600">{pending.length} pending</span>}
                            {unalloc > 0 && <span className="text-gray-400">{unalloc} unallocated</span>}
                        </div>
                    </div>
                </div>
                {pending.length > 0 && (
                    <button onClick={() => onBulkApproveCollege(pendingIds)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                        <Check size={12} /> Approve All ({pending.length})
                    </button>
                )}
            </div>

            {/* Proposal rows */}
            <div className="p-3 space-y-2">
                {proposals.map(p => (
                    <ProposalBudgetRow
                        key={p.id}
                        proposal={p}
                        roles={roles}
                        canAllocate={canAllocate}
                        selectedIds={selectedIds}
                        onSelect={onSelect}
                        onAllocate={onAllocate}
                        onApprove={onApprove}
                        onEdit={onEdit}
                    />
                ))}
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetAllocations() {
    const { success, error } = useToast()

    const user  = getUser()
    const roles = getRoles(user)

    // Who can approve: central/category officers only (NOT college officers)
    const userCanApproveAny = roles.some(r =>
        ['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'].includes(r)
    )
    // Who can allocate and approve: central admins + category officers only
    const canAllocate = roles.some(r =>
        ['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'].includes(r)
    )
    // Who can filter by college: only global admins
    const isCentral = roles.some(r => ['super_admin', 'admin', 'central_officer'].includes(r))

    const [proposals,          setProposals]          = useState([])
    const [colleges,           setColleges]           = useState([])
    const [stats,              setStats]              = useState(null)
    const [fiscalYears,        setFiscalYears]        = useState([])
    const currentAcademicYear = usePage().props.app_settings?.current_academic_year ?? ''
    const [loading,            setLoading]            = useState(true)
    const [selectedIds,        setSelectedIds]        = useState(new Set())

    // Filters
    const [yearFilter,    setYearFilter]    = useState(currentAcademicYear)
    const [collegeFilter, setCollegeFilter] = useState('')

    // Modals
    const [allocProposal, setAllocProposal] = useState(null)
    const [editAlloc,     setEditAlloc]     = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (yearFilter)    params.set('academic_year', yearFilter)
            if (collegeFilter) params.set('college_id',    collegeFilter)

            const [pRes, sRes, yRes] = await Promise.all([
                api.get(`/budget-allocations/proposal-budgets?${params}`),
                api.get('/budget-allocations/stats'),
                api.get('/budget-allocations/fiscal-years'),
            ])
            setProposals(pRes.data?.data ?? [])
            setStats(sRes.data?.data ?? null)
            setFiscalYears(yRes.data?.data ?? [])
        } catch {
            error('Failed to load budget allocations.')
        }
        setLoading(false)
    }, [yearFilter, collegeFilter])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        if (isCentral) {
            api.get('/colleges').then(r => setColleges(r.data?.data ?? [])).catch(() => {})
        }
    }, [isCentral])

    // Derive academic years from proposals (for the filter dropdown)
    const academicYears = [...new Set(proposals.map(p => p.academic_year).filter(Boolean))].sort().reverse()

    // Group by college
    const byCollege = proposals.reduce((acc, p) => {
        const name = p.college?.name ?? 'Unknown'
        ;(acc[name] ??= []).push(p)
        return acc
    }, {})

    // Total pending that the current user can approve
    const approvablePendingIds = proposals
        .filter(p => p.budget_allocations?.[0]?.status === 'pending' && canApproveCategory(roles, p.category))
        .map(p => p.budget_allocations[0].id)

    const toggleSelect = (id) => setSelectedIds(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
    })

    const handleSelectAll = (ids, selectAll) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            ids.forEach(id => selectAll ? next.add(id) : next.delete(id))
            return next
        })
    }

    const handleSelectAllPending = () => {
        if (approvablePendingIds.every(id => selectedIds.has(id))) {
            setSelectedIds(new Set()) // deselect all
        } else {
            setSelectedIds(new Set(approvablePendingIds))
        }
    }

    const handleApproveOne = async (allocId) => {
        try {
            await api.post(`/budget-allocations/${allocId}/approve`)
            success('Allocation approved.')
            load()
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to approve.')
        }
    }

    const handleBulkApprove = async (ids) => {
        if (!ids.length) return error('No approvable allocations selected.')
        try {
            const res = await api.post('/budget-allocations/bulk-approve', { ids })
            success(res.data?.message ?? 'Allocations approved.')
            setSelectedIds(new Set())
            load()
        } catch (e) {
            error(e.response?.data?.message ?? 'Failed to bulk approve.')
        }
    }

    return (
        <AppLayout breadcrumb="Budget Allocations">
            <div className="max-w-6xl mx-auto space-y-5 p-6">

                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <PieChart size={24} className="text-indigo-600" />
                            Budget Allocations
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Review funded proposal budgets — approve to unlock PI budget requests
                        </p>
                    </div>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {[
                            { label: 'Colleges',           value: stats.colleges_with_budget,                color: 'text-indigo-600', icon: '🏛' },
                            { label: 'Total Awarded',      value: formatCurrency(stats.total_budget),         color: 'text-gray-900',   icon: '💰', large: true },
                            { label: 'Approved Alloc.',    value: formatCurrency(stats.total_allocated),      color: 'text-green-600',  icon: '✅', large: true },
                            { label: 'Remaining',          value: formatCurrency(stats.total_remaining),      color: 'text-blue-600',   icon: '📊', large: true },
                            { label: 'Pending Approval',   value: approvablePendingIds.length,               color: approvablePendingIds.length > 0 ? 'text-amber-600' : 'text-gray-400', icon: '⏳' },
                        ].map(s => (
                            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                                <div className="text-xl mb-1">{s.icon}</div>
                                <div className={`${s.large ? 'text-base' : 'text-xl'} font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Workflow info */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                        <strong>Approval is restricted</strong> to Research, Community, and Technology Officers (and central admins) — each approves only their own category.

                        PIs cannot submit budget requests until the allocation is approved.
                    </p>
                </div>

                {/* Filters + Bulk Actions bar */}
                <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <Filter size={15} className="text-gray-400 shrink-0" />

                    {/* Academic year */}
                    <div className="relative">
                        <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setSelectedIds(new Set()) }}
                            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                            <option value="">All Academic Years</option>
                            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>

                    {/* College (central only) */}
                    {isCentral && (
                        <div className="relative">
                            <select value={collegeFilter} onChange={e => { setCollegeFilter(e.target.value); setSelectedIds(new Set()) }}
                                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                                <option value="">All Colleges</option>
                                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Bulk approve controls — only for users who can approve */}
                    {userCanApproveAny && approvablePendingIds.length > 0 && (
                        <div className="flex items-center gap-2 ml-auto">
                            <button onClick={handleSelectAllPending}
                                className="text-xs font-medium text-indigo-600 hover:underline">
                                {approvablePendingIds.every(id => selectedIds.has(id)) ? 'Deselect All' : `Select All Pending (${approvablePendingIds.length})`}
                            </button>
                            <button
                                onClick={() => handleBulkApprove([...selectedIds])}
                                disabled={selectedIds.size === 0}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    selectedIds.size > 0
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}>
                                <Check size={12} />
                                Approve Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <PieChart size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-600 font-medium">No funded proposals</p>
                        <p className="text-sm text-gray-400 mt-1">Budget allocations appear here once proposals are funded and awarded.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {Object.entries(byCollege).map(([collegeName, collegeProposals]) => (
                            <CollegeSection
                                key={collegeName}
                                collegeName={collegeName}
                                proposals={collegeProposals}
                                roles={roles}
                                canAllocate={canAllocate}
                                selectedIds={selectedIds}
                                onSelect={toggleSelect}
                                onSelectAll={handleSelectAll}
                                onAllocate={setAllocProposal}
                                onApprove={handleApproveOne}
                                onBulkApproveCollege={(ids) => handleBulkApprove(ids)}
                                onEdit={setEditAlloc}
                            />
                        ))}
                    </div>
                )}
            </div>

            {allocProposal && (
                <FiscalYearModal
                    proposal={allocProposal}
                    fiscalYears={fiscalYears}
                    defaultYear={currentAcademicYear}
                    onClose={() => setAllocProposal(null)}
                    onSuccess={() => {
                        setAllocProposal(null)
                        success('Allocation created — pending approval by the category officer.')
                        load()
                    }}
                />
            )}

            {editAlloc && (
                <EditAllocationModal
                    allocation={editAlloc}
                    onClose={() => setEditAlloc(null)}
                    onSuccess={() => {
                        setEditAlloc(null)
                        success('Allocation updated.')
                        load()
                    }}
                />
            )}
        </AppLayout>
    )
}
