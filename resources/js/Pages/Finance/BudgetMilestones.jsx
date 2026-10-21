import { useState, useEffect } from 'react'
import {
    CheckCircle2, Clock, AlertCircle, Circle, Plus, X,
    Edit2, Trash2, Loader2, DollarSign, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import ConfirmDialog from '../../Components/ConfirmDialog'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../Components/Toast'
import { get, post, put, del } from '../../lib/api'
import { formatDate, formatCurrency, cn } from '../../lib/utils'

const STATUS_CONFIG = {
    pending:     { label: 'Pending',     icon: Circle,       cls: 'bg-gray-100 text-gray-600',   bar: 'bg-gray-300'   },
    in_progress: { label: 'In Progress', icon: Clock,        cls: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-500'   },
    completed:   { label: 'Completed',   icon: CheckCircle2, cls: 'bg-green-100 text-green-700', bar: 'bg-green-500'  },
    overdue:     { label: 'Overdue',     icon: AlertCircle,  cls: 'bg-red-100 text-red-700',     bar: 'bg-red-500'    },
}

const EMPTY_FORM = { title: '', description: '', amount: '', due_date: '', sort_order: '' }

function MilestoneForm({ open, onClose, onSaved, initial, proposalId }) {
    const [form, setForm] = useState(initial ?? EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const { error } = useToast()

    useEffect(() => { if (open) setForm(initial ?? EMPTY_FORM) }, [open])

    const save = async () => {
        if (!form.title) { error('Title is required.'); return }
        setSaving(true)
        try {
            if (initial?.id) {
                const r = await put(`/proposals/${proposalId}/milestones/${initial.id}`, form)
                onSaved(r.data?.data)
            } else {
                const r = await post(`/proposals/${proposalId}/milestones`, form)
                onSaved(r.data?.data)
            }
            onClose()
        } catch (e) {
            error(e?.response?.data?.message ?? 'Failed to save milestone.')
        } finally { setSaving(false) }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-bold text-gray-900">{initial?.id ? 'Edit Milestone' : 'Add Milestone'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
                        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Milestone name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Budget Amount</label>
                            <input type="number" min="0" value={form.amount}
                                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="0.00" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date</label>
                            <input type="date" value={form.due_date}
                                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                        <textarea value={form.description} rows={3}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="Optional details…" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                        {saving && <Loader2 size={12} className="animate-spin" />}
                        {initial?.id ? 'Save Changes' : 'Add Milestone'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function MilestoneRow({ milestone, canEdit, onEdit, onDelete, onStatusChange, proposalId }) {
    const effectiveStatus = milestone.completed_at ? 'completed'
        : (milestone.due_date && new Date(milestone.due_date) < new Date() && milestone.status !== 'completed') ? 'overdue'
        : milestone.status
    const cfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.pending
    const Icon = cfg.icon
    const [changing, setChanging] = useState(false)

    const markComplete = async () => {
        setChanging(true)
        try {
            const r = await put(`/proposals/${proposalId}/milestones/${milestone.id}`, {
                status: milestone.status === 'completed' ? 'pending' : 'completed',
            })
            onStatusChange(r.data?.data)
        } catch {}
        finally { setChanging(false) }
    }

    return (
        <div className="flex items-start gap-4 group">
            {/* timeline dot */}
            <div className="flex flex-col items-center shrink-0 pt-0.5">
                <button onClick={markComplete} disabled={!canEdit || changing}
                    className={cn(
                        'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
                        effectiveStatus === 'completed'
                            ? 'bg-green-500 border-green-500 text-white'
                            : effectiveStatus === 'overdue'
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-300 bg-white hover:border-indigo-400',
                        !canEdit && 'cursor-default'
                    )}>
                    {changing ? <Loader2 size={10} className="animate-spin text-gray-400" />
                    : effectiveStatus === 'completed' ? <CheckCircle2 size={12} />
                    : <span className="h-2 w-2 rounded-full bg-gray-300" />}
                </button>
            </div>
            {/* content */}
            <div className={cn(
                'flex-1 border rounded-xl p-4 transition-all',
                effectiveStatus === 'overdue' ? 'border-red-200 bg-red-50/50'
                : effectiveStatus === 'completed' ? 'border-green-100 bg-green-50/30'
                : 'border-gray-100 bg-white group-hover:border-gray-200'
            )}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1', cfg.cls)}>
                                <Icon size={9} /> {cfg.label}
                            </span>
                            {milestone.amount && (
                                <span className="text-[11px] text-gray-500 font-medium">{formatCurrency(milestone.amount)}</span>
                            )}
                        </div>
                        <p className={cn('text-sm font-semibold', effectiveStatus === 'completed' ? 'line-through text-gray-400' : 'text-gray-900')}>
                            {milestone.title}
                        </p>
                        {milestone.description && (
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{milestone.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-400">
                            {milestone.due_date && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={10} /> Due {formatDate(milestone.due_date)}
                                </span>
                            )}
                            {milestone.completed_at && (
                                <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle2 size={10} /> Completed {formatDate(milestone.completed_at)}
                                </span>
                            )}
                        </div>
                    </div>
                    {canEdit && (
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onEdit(milestone)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <Edit2 size={12} />
                            </button>
                            <button onClick={() => onDelete(milestone)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function ProposalMilestonePanel({ proposal, canEdit }) {
    const [milestones, setMilestones] = useState([])
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [deleting, setDeleting] = useState(null)
    const { success, error } = useToast()

    const load = async () => {
        setLoading(true)
        try {
            const r = await get(`/proposals/${proposal.id}/milestones`)
            setMilestones(r.data?.data ?? [])
        } catch {}
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [proposal.id])

    const handleSaved = (item) => {
        if (editing?.id) {
            setMilestones(p => p.map(m => m.id === item.id ? item : m))
            success('Milestone updated.')
        } else {
            setMilestones(p => [...p, item])
            success('Milestone added.')
        }
        setEditing(null)
    }

    const handleDelete = async () => {
        try {
            await del(`/proposals/${proposal.id}/milestones/${deleting.id}`)
            setMilestones(p => p.filter(m => m.id !== deleting.id))
            success('Milestone deleted.')
        } catch { error('Failed to delete.') }
        finally { setDeleting(null) }
    }

    const handleStatusChange = (item) => setMilestones(p => p.map(m => m.id === item.id ? item : m))

    const completed = milestones.filter(m => m.status === 'completed' || m.completed_at).length
    const total = milestones.length
    const totalBudget = milestones.reduce((s, m) => s + parseFloat(m.amount ?? 0), 0)
    const disbursed = milestones
        .filter(m => m.status === 'completed' || m.completed_at)
        .reduce((s, m) => s + parseFloat(m.amount ?? 0), 0)
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <p className="text-sm font-bold text-gray-800">{proposal.tracker_number}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{proposal.title}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-xs font-semibold text-gray-800">{completed}/{total} done</p>
                        {totalBudget > 0 && <p className="text-[10px] text-gray-400">{formatCurrency(disbursed)} / {formatCurrency(totalBudget)}</p>}
                    </div>
                    {canEdit && (
                        <button onClick={() => { setEditing(null); setFormOpen(true) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                            <Plus size={12} /> Add
                        </button>
                    )}
                </div>
            </div>
            {/* Progress bar */}
            {total > 0 && (
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-500 font-medium shrink-0">{pct}%</span>
                    </div>
                </div>
            )}
            <div className="p-5 space-y-4">
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
                    </div>
                ) : milestones.length === 0 ? (
                    <div className="text-center py-6">
                        <Clock size={24} className="text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">No milestones yet</p>
                        {canEdit && (
                            <button onClick={() => { setEditing(null); setFormOpen(true) }}
                                className="mt-2 text-xs text-indigo-500 font-semibold hover:text-indigo-700">
                                + Add first milestone
                            </button>
                        )}
                    </div>
                ) : (
                    milestones.map(m => (
                        <MilestoneRow
                            key={m.id}
                            milestone={m}
                            canEdit={canEdit}
                            onEdit={item => { setEditing(item); setFormOpen(true) }}
                            onDelete={setDeleting}
                            onStatusChange={handleStatusChange}
                            proposalId={proposal.id}
                        />
                    ))
                )}
            </div>

            <MilestoneForm
                open={formOpen}
                onClose={() => { setFormOpen(false); setEditing(null) }}
                onSaved={handleSaved}
                initial={editing}
                proposalId={proposal.id}
            />

            {deleting && (
                <ConfirmDialog
                    open
                    title="Delete milestone?"
                    description={`"${deleting.title}" will be permanently removed.`}
                    confirmLabel="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </div>
    )
}

export default function BudgetMilestones() {
    const { hasPermission } = useAuth()
    const canEdit = hasPermission('budget_milestones.update')
    const { error } = useToast()

    const [proposals, setProposals] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const r = await get('/proposals', {
                    status: 'funded,midterm_evaluation,completed',
                    per_page: 50,
                    search: search || undefined,
                })
                setProposals(r.data?.data ?? [])
            } catch { error('Failed to load funded proposals.') }
            finally { setLoading(false) }
        }
        load()
    }, [search])

    return (
        <AppLayout breadcrumb="Budget Milestones">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Budget Milestone Tracker</h1>
                        <p className="text-sm text-gray-500 mt-1">Track disbursement milestones for funded proposals</p>
                    </div>
                    <div className="relative">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search proposals…"
                            className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
                        />
                        <DollarSign size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="flex flex-col items-center py-20 bg-white border border-gray-100 rounded-2xl">
                        <DollarSign size={36} className="text-gray-200 mb-3" />
                        <p className="text-gray-500 font-medium">No funded proposals found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {proposals.map(p => (
                            <ProposalMilestonePanel key={p.id} proposal={p} canEdit={canEdit} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
