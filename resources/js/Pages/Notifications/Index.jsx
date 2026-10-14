import { useState, useEffect, useCallback, useRef } from 'react'
import { router } from '@inertiajs/react'
import {
    Bell, X, Check, CheckCheck, Trash2, Filter,
    FileText, FileCheck, DollarSign, Trophy,
    ClipboardList, CheckCircle2, XCircle,
    AlertTriangle, AlertCircle, Calendar, MessageSquare,
    Users, PenLine, Inbox, Zap, ChevronDown,
    RotateCcw,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { get, post, del } from '../../lib/api'
import { timeAgo } from '../../lib/utils'
import { useToast } from '../../Components/Toast'

// ─── Shared type registry (mirrors NotificationBell.jsx) ──────────────────────

const TYPE_CFG = {
    submission_success:   { icon: FileCheck,     color: 'blue',   label: 'Submission Received',  category: 'activity', actionLabel: 'View Proposal',  actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals', template: d => `Proposal ${d.tracker_number || ''} submitted successfully` },
    budget_allocated:     { icon: DollarSign,    color: 'emerald',label: 'Budget Allocated',      category: 'activity', actionLabel: 'View Budget',    actionUrl: () => '/budget',              template: d => `Budget allocated for ${d.tracker_number || 'your proposal'}` },
    award_approval:       { icon: Trophy,        color: 'yellow', label: 'Award Approved',        category: 'activity', actionLabel: 'View Proposal',  actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals', template: d => `Proposal ${d.tracker_number || ''} has been awarded` },
    review_assignment:    { icon: ClipboardList, color: 'indigo', label: 'Review Assigned',       category: 'action',   actionLabel: 'Review Now',     actionUrl: () => '/proposals/reviewee',  template: d => `Assigned to review ${d.tracker_number || ''} — ${d.review_type || ''}` },
    review_assignment_cancelled: { icon: XCircle, color: 'gray', label: 'Assignment Cancelled', category: 'activity', actionLabel: null, actionUrl: () => '/notifications', template: d => `Your review assignment for ${d.tracker_number || ''} was cancelled — the proposal was rejected` },
    proposal_approved:    { icon: CheckCircle2,  color: 'green',  label: 'Proposal Approved',     category: 'activity', actionLabel: 'View Proposal',  actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals', template: d => `Proposal ${d.tracker_number || ''} approved` },
    proposal_rejected:    { icon: XCircle,       color: 'red',    label: 'Proposal Rejected',     category: 'activity', actionLabel: 'View Details',   actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals', template: d => `Proposal ${d.tracker_number || ''} was not approved` },
    central_eval_approved:{ icon: CheckCircle2,  color: 'green',  label: 'Advanced to Central Evaluation', category: 'activity', actionLabel: 'View Proposal',  actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals', template: d => `Your proposal ${d.tracker_number || ''} passed open defence and is now in Central Evaluation` },
    decision_result:      { icon: Bell,          color: 'gray',   label: 'Decision Update',       category: 'activity', actionLabel: 'View Details',   actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals', template: d => d.title || `Decision on ${d.tracker_number || 'proposal'}` },
    proposal_submitted_officer: { icon: Inbox,   color: 'blue',   label: 'New Submission',        category: 'action',   actionLabel: 'Review',         actionUrl: () => '/proposals',           template: d => `New proposal submitted: ${d.tracker_number || ''}` },
    budget_request_approved:    { icon: DollarSign, color: 'teal',label: 'Budget Approved',       category: 'activity', actionLabel: 'View Budget',    actionUrl: () => '/budget',              template: d => `Budget request (Round ${d.round_number || 1}) approved for ${d.tracker_number || ''}` },
    funding_revoked:      { icon: AlertTriangle, color: 'red',    label: 'Funding Revoked',       category: 'activity', actionLabel: 'View Details',   actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals', template: d => `Funding revoked for ${d.tracker_number || ''}` },
    signature_required:   { icon: PenLine,       color: 'amber',  label: 'Signature Required',    category: 'action',   actionLabel: 'Sign Now',       actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals', template: d => `Signature required for ${d.tracker_number || ''}` },
    midterm_scheduled:    { icon: Calendar,      color: 'blue',   label: 'M&E Scheduled',         category: 'activity', actionLabel: 'View',           actionUrl: () => '/midterm-evaluations', template: d => `Midterm evaluation for ${d.tracker_number || ''} on ${d.evaluation_date || ''}` },
    midterm_report_submitted: { icon: FileText,  color: 'purple', label: 'M&E Report Ready',      category: 'action',   actionLabel: 'Score Now',      actionUrl: () => '/midterm-evaluations', template: d => `Midterm report submitted for ${d.tracker_number || ''}. Ready to score.` },
    midterm_hold:         { icon: AlertTriangle, color: 'red',    label: 'M&E Hold',              category: 'activity', actionLabel: 'View',           actionUrl: () => '/midterm-evaluations', template: d => `Midterm on hold for ${d.tracker_number || ''} from ${d.college || ''}` },
    workshop_scheduled:   { icon: Calendar,      color: 'violet', label: 'Workshop Scheduled',    category: 'activity', actionLabel: 'View Workshop',  actionUrl: () => '/completion-workshops',template: d => `Completion workshop on ${d.date || ''} at ${d.venue || ''}` },
    complaint_response:   { icon: MessageSquare, color: 'orange', label: 'Complaint Response',    category: 'activity', actionLabel: 'View Complaint', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals', template: d => `Complaint ${d.resolution || 'updated'} for ${d.tracker_number || ''}` },
    complaint_filed:      { icon: AlertCircle,   color: 'red',    label: 'Complaint Filed',       category: 'activity', actionLabel: 'View',           actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals', template: d => `Complaint filed for ${d.tracker_number || ''}` },
    output_recorded:      { icon: FileCheck,     color: 'indigo', label: 'Output Recorded',       category: 'activity', actionLabel: 'View',           actionUrl: () => '/proposals',           template: d => `Research output recorded for ${d.tracker_number || ''}` },
    co_investigator_notified: { icon: Users,     color: 'blue',   label: 'Co-Investigator',       category: 'activity', actionLabel: 'View Proposal',  actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals', template: d => `Added as co-investigator on ${d.tracker_number || ''}` },
    co_pi_response:       { icon: MessageSquare, color: 'blue',   label: 'Co-PI Response',        category: 'activity', actionLabel: 'View',           actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals', template: d => `${d.co_pi_name || 'Your co-investigator'} ${d.response === 'accepted' ? 'accepted' : 'declined'} your invitation on ${d.tracker_number || ''}` },
    'App\\Notifications\\SystemAlertNotification': { icon: AlertCircle, color: 'amber', label: 'System Alert', category: 'activity', actionLabel: null, actionUrl: () => '/notifications', template: d => d.message || d.title || 'System notification' },
    progress_report_due: { icon: Calendar, color: 'amber', label: 'Progress Report Due', category: 'action', actionLabel: 'Open Reports', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Progress` : '/progress-reports', template: d => d.message || 'Progress Report Due' },
    progress_report_overdue: { icon: AlertCircle, color: 'red', label: 'Progress Report Overdue', category: 'action', actionLabel: 'Open Reports', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Progress` : '/progress-reports', template: d => d.message || 'Progress Report Overdue' },
    progress_report_submitted: { icon: ClipboardList, color: 'blue', label: 'Progress Report Submitted', category: 'action', actionLabel: 'Review Report', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Progress` : '/progress-reports', template: d => d.message || 'Progress Report Submitted' },
    data_deletion_requested: { icon: AlertTriangle, color: 'amber', label: 'Data Deletion Request', category: 'action', actionLabel: 'Review Request', actionUrl: () => '/admin/data-requests', template: d => d.message || 'Someone asked for their personal data to be deleted' },
    data_deletion_reviewed: { icon: AlertTriangle, color: 'blue', label: 'Data Deletion Request', category: 'activity', actionLabel: 'Open Profile', actionUrl: () => '/profile', template: d => d.message || 'Your data deletion request was reviewed' },
    review_certificate_released: { icon: Trophy, color: 'yellow', label: 'Certificate Ready', category: 'activity', actionLabel: 'Open My Reviews', actionUrl: () => '/reviews', template: d => d.message || 'Your certificate of review service is ready' },
    review_certificate_revoked: { icon: AlertTriangle, color: 'red', label: 'Certificate Revoked', category: 'activity', actionLabel: 'Open My Reviews', actionUrl: () => '/reviews', template: d => d.message || 'Your certificate of review service was revoked' },
    progress_report_reviewed: { icon: CheckCircle2, color: 'green', label: 'Progress Report Reviewed', category: 'activity', actionLabel: 'Open Reports', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Progress` : '/progress-reports', template: d => d.message || 'Progress Report Reviewed' },
    stage_reminder:              { icon: AlertTriangle, color: 'amber',  label: 'Action Needed', category: 'action', actionLabel: 'Open Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/notifications', template: d => d.message || `${d.tracker_number || 'A proposal'} is waiting on you` },
    review_disagreement:         { icon: AlertTriangle, color: 'amber',  label: 'Reviewers Disagree', category: 'action', actionLabel: 'Open Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/admin/blind-review', template: d => d.message || `Blind reviewers disagree on ${d.tracker_number || 'a proposal'}` },
    defence_extension_requested: { icon: Calendar,      color: 'amber',  label: 'Defence Deadline Extension Request', category: 'action', actionLabel: 'Review Request', actionUrl: () => '/admin/defence-extensions', template: d => d.message || `Score deadline extension requested for ${d.tracker_number || 'a proposal'}` },
    defence_extension_resolved:  { icon: Calendar,      color: 'violet', label: 'Defence Extension Decision', category: 'activity', actionLabel: 'Open Defence', actionUrl: () => '/admin/open-defence', template: d => d.message || `Your extension request for ${d.tracker_number || 'a proposal'} was ${d.decision || 'decided'}` },
    defence_deadline_extended:   { icon: Calendar,      color: 'violet', label: 'Defence Deadline Extended', category: 'action', actionLabel: 'My Reviews', actionUrl: () => '/reviews', template: d => d.message || `The defence score deadline for ${d.tracker_number || 'a proposal'} was extended` },
    defence_deadline_reminder:   { icon: AlertTriangle, color: 'amber',  label: 'Defence Score Due', category: 'action', actionLabel: 'My Reviews', actionUrl: () => '/reviews', template: d => d.message || `Your defence score for ${d.tracker_number || 'a proposal'} is due soon` },
    defence_deadline_passed:     { icon: AlertCircle,   color: 'red',    label: 'Defence Deadline Passed', category: 'action', actionLabel: 'Open Defence', actionUrl: () => '/admin/open-defence', template: d => d.message || `The defence score deadline for ${d.tracker_number || 'a proposal'} has passed` },
    default: { icon: Bell, color: 'gray', label: 'Notification', category: 'activity', actionLabel: null, actionUrl: () => '/notifications', template: d => d.message || d.title || 'New notification' },
}

const COLORS = {
    blue:    { icon: 'bg-blue-100 text-blue-600',       badge: 'text-blue-700 bg-blue-50 border-blue-200',     dot: 'bg-blue-500',    action: 'bg-blue-600 hover:bg-blue-700 text-white' },
    emerald: { icon: 'bg-emerald-100 text-emerald-600', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', action: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    green:   { icon: 'bg-green-100 text-green-600',     badge: 'text-green-700 bg-green-50 border-green-200',   dot: 'bg-green-500',   action: 'bg-green-600 hover:bg-green-700 text-white' },
    yellow:  { icon: 'bg-yellow-100 text-yellow-600',   badge: 'text-yellow-700 bg-yellow-50 border-yellow-200',dot: 'bg-yellow-500',  action: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
    amber:   { icon: 'bg-amber-100 text-amber-600',     badge: 'text-amber-700 bg-amber-50 border-amber-200',   dot: 'bg-amber-500',   action: 'bg-amber-600 hover:bg-amber-700 text-white' },
    red:     { icon: 'bg-red-100 text-red-600',         badge: 'text-red-700 bg-red-50 border-red-200',         dot: 'bg-red-500',     action: 'bg-red-600 hover:bg-red-700 text-white' },
    indigo:  { icon: 'bg-indigo-100 text-indigo-600',   badge: 'text-indigo-700 bg-indigo-50 border-indigo-200',dot: 'bg-indigo-500',  action: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
    purple:  { icon: 'bg-purple-100 text-purple-600',   badge: 'text-purple-700 bg-purple-50 border-purple-200',dot: 'bg-purple-500',  action: 'bg-purple-600 hover:bg-purple-700 text-white' },
    violet:  { icon: 'bg-violet-100 text-violet-600',   badge: 'text-violet-700 bg-violet-50 border-violet-200',dot: 'bg-violet-500',  action: 'bg-violet-600 hover:bg-violet-700 text-white' },
    teal:    { icon: 'bg-teal-100 text-teal-600',       badge: 'text-teal-700 bg-teal-50 border-teal-200',      dot: 'bg-teal-500',    action: 'bg-teal-600 hover:bg-teal-700 text-white' },
    orange:  { icon: 'bg-orange-100 text-orange-600',   badge: 'text-orange-700 bg-orange-50 border-orange-200',dot: 'bg-orange-500',  action: 'bg-orange-600 hover:bg-orange-700 text-white' },
    gray:    { icon: 'bg-gray-100 text-gray-500',       badge: 'text-gray-600 bg-gray-50 border-gray-200',      dot: 'bg-gray-400',    action: 'bg-gray-600 hover:bg-gray-700 text-white' },
}

function getCfg(type)    { return TYPE_CFG[type] ?? TYPE_CFG.default }
function getColors(type) { return COLORS[getCfg(type).color] ?? COLORS.gray }
function getMessage(type, data) { return getCfg(type).template(data ?? {}) }
function getActionUrl(type, data) { return getCfg(type).actionUrl(data ?? {}) }

function groupByDate(items) {
    const today     = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const g         = { Today: [], Yesterday: [], Earlier: [] }
    for (const n of items) {
        const d = new Date(n.created_at); d.setHours(0, 0, 0, 0)
        if (d >= today)          g.Today.push(n)
        else if (d >= yesterday) g.Yesterday.push(n)
        else                     g.Earlier.push(n)
    }
    return g
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, colorClass, onClick, active }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all
                        ${active
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}
        >
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-white/20' : colorClass}`}>
                <Icon size={16} className={active ? 'text-white' : ''} />
            </div>
            <div>
                <p className={`text-xl font-bold leading-none ${active ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                <p className={`text-xs mt-0.5 ${active ? 'text-blue-100' : 'text-gray-500'}`}>{label}</p>
            </div>
        </button>
    )
}

// ─── Notification card ────────────────────────────────────────────────────────

function NotificationCard({ n, selected, onSelect, onMarkRead, onDelete }) {
    const cfg    = getCfg(n.type)
    const colors = getColors(n.type)
    const Icon   = cfg.icon
    const msg    = getMessage(n.type, n.data)
    const url    = getActionUrl(n.type, n.data)
    const isUnread = !n.read_at

    return (
        <div
            className={`relative group flex items-start gap-4 px-5 py-4 rounded-2xl border transition-all
                        ${isUnread
                            ? 'bg-white border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200'
                            : 'bg-gray-50/60 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm'}`}
        >
            {/* Unread left stripe */}
            {isUnread && (
                <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-blue-500" />
            )}

            {/* Checkbox */}
            <div
                className="mt-0.5 shrink-0 cursor-pointer"
                onClick={() => onSelect(n.id)}
            >
                <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-all
                                 ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}>
                    {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
            </div>

            {/* Icon */}
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                <Icon size={18} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${colors.badge}`}>
                        {cfg.label}
                    </span>
                    {cfg.category === 'action' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                            <Zap size={10} /> Action required
                        </span>
                    )}
                    {isUnread && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-blue-600">
                            <div className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} /> Unread
                        </span>
                    )}
                </div>

                <p className={`text-sm leading-snug ${isUnread ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                    {msg}
                </p>

                {n.data?.tracker_number && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{n.data.tracker_number}</p>
                )}

                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>

                    {cfg.actionLabel && (
                        <button
                            onClick={() => {
                                router.visit(url)
                                if (isUnread) onMarkRead([n.id])
                            }}
                            className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${colors.action}`}
                        >
                            {cfg.actionLabel} →
                        </button>
                    )}

                    {isUnread && (
                        <button
                            onClick={() => onMarkRead([n.id])}
                            className="text-xs font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                        >
                            <Check size={11} /> Mark read
                        </button>
                    )}
                </div>
            </div>

            {/* Delete */}
            <button
                onClick={() => onDelete(n.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100 mt-0.5"
                title="Delete notification"
            >
                <Trash2 size={13} />
            </button>
        </div>
    )
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick, count }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                        ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
        >
            {label}
            {count != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {count}
                </span>
            )}
        </button>
    )
}

// ─── Date group header ────────────────────────────────────────────────────────

function DateGroup({ label, children }) {
    return (
        <div>
            <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">{label}</span>
                <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="space-y-2.5">{children}</div>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
    { key: 'all',      label: 'All' },
    { key: 'action',   label: '⚡ Action Required' },
    { key: 'activity', label: 'Activity' },
]

export default function NotificationsIndex() {
    const { success, error } = useToast()

    const [notifications, setNotifications] = useState([])
    const [loading,       setLoading]       = useState(true)
    const [meta,          setMeta]          = useState({ total: 0, unread_count: 0, last_page: 1, current_page: 1 })
    const [typeFilter,    setTypeFilter]    = useState('all')
    const [unreadOnly,    setUnreadOnly]    = useState(false)
    const [selected,      setSelected]      = useState(new Set())
    const [page,          setPage]          = useState(1)
    const [loadingMore,   setLoadingMore]   = useState(false)

    const load = useCallback(async (p = 1, append = false) => {
        if (p === 1) setLoading(true)
        else         setLoadingMore(true)

        try {
            const params = { page: p, per_page: 20 }
            if (unreadOnly) params.unread = 1
            const r     = await get('/notifications', params)
            const items = (r.data ?? []).filter(n => {
                if (typeFilter === 'all') return true
                return getCfg(n.type).category === typeFilter
            })

            if (append) {
                setNotifications(prev => [...prev, ...items])
            } else {
                setNotifications(items)
                setSelected(new Set())
            }

            setMeta(r.meta ?? {})
            setPage(p)
        } catch {
            error('Failed to load notifications.')
        }

        setLoading(false)
        setLoadingMore(false)
    }, [unreadOnly, typeFilter, error])

    useEffect(() => { load(1) }, [load])

    // ── Selection ──
    const toggleSelect = (id) => setSelected(prev => {
        const s = new Set(prev)
        s.has(id) ? s.delete(id) : s.add(id)
        return s
    })
    const allSelected = notifications.length > 0 && selected.size === notifications.length
    const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(notifications.map(n => n.id)))

    // ── Actions ──
    const markRead = async (ids) => {
        await post('/notifications/read', { ids }).catch(() => {})
        setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
        setMeta(prev => ({ ...prev, unread_count: Math.max(0, (prev.unread_count ?? 0) - ids.filter(id => notifications.find(n => n.id === id && !n.read_at)).length) }))
        setSelected(new Set())
        success(`${ids.length} notification${ids.length !== 1 ? 's' : ''} marked as read.`)
    }

    const markAllRead = async () => {
        await post('/notifications/read-all', {}).catch(() => {})
        setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
        setMeta(prev => ({ ...prev, unread_count: 0 }))
        setSelected(new Set())
        success('All notifications marked as read.')
    }

    const deleteOne = async (id) => {
        await del(`/notifications/${id}`).catch(() => {})
        setNotifications(prev => prev.filter(n => n.id !== id))
        setMeta(prev => ({ ...prev, total: Math.max(0, (prev.total ?? 0) - 1) }))
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    }

    const clearRead = async () => {
        await del('/notifications/read').catch(() => {})
        setNotifications(prev => prev.filter(n => !n.read_at))
        success('Read notifications cleared.')
    }

    const bulkMarkRead = () => markRead([...selected])

    // ── Computed ──
    const actionCount  = notifications.filter(n => getCfg(n.type).category === 'action' && !n.read_at).length
    const unreadCount  = meta.unread_count ?? 0
    const totalCount   = meta.total ?? 0
    const groups       = groupByDate(notifications)
    const hasMore      = (meta.current_page ?? 1) < (meta.last_page ?? 1)
    const readCount    = notifications.filter(n => n.read_at).length

    return (
        <AppLayout breadcrumb="Notifications">
            <div className="max-w-4xl mx-auto space-y-6 p-6">

                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                            <div className="h-9 w-9 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Bell size={18} className="text-blue-600" />
                            </div>
                            Notifications
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 ml-11.5">
                            {unreadCount > 0 ? `${unreadCount} unread · ` : ''}
                            {totalCount} total
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
                            >
                                <CheckCheck size={15} /> Mark all read
                            </button>
                        )}
                        {readCount > 0 && (
                            <button
                                onClick={clearRead}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
                            >
                                <Trash2 size={14} /> Clear read
                            </button>
                        )}
                        <button
                            onClick={() => load(1)}
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Refresh"
                        >
                            <RotateCcw size={15} />
                        </button>
                    </div>
                </div>

                {/* ── Stat cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard label="Total" value={totalCount} icon={Bell} colorClass="bg-gray-100 text-gray-500"
                        onClick={() => { setTypeFilter('all'); setUnreadOnly(false) }}
                        active={typeFilter === 'all' && !unreadOnly}
                    />
                    <StatCard label="Unread" value={unreadCount} icon={Inbox} colorClass="bg-blue-100 text-blue-600"
                        onClick={() => { setTypeFilter('all'); setUnreadOnly(v => !v) }}
                        active={unreadOnly}
                    />
                    <StatCard label="Action Required" value={actionCount} icon={Zap} colorClass="bg-amber-100 text-amber-600"
                        onClick={() => { setTypeFilter('action'); setUnreadOnly(false) }}
                        active={typeFilter === 'action'}
                    />
                </div>

                {/* ── Filters ── */}
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                    {TYPE_FILTERS.map(f => (
                        <FilterPill
                            key={f.key}
                            label={f.label}
                            active={typeFilter === f.key && !unreadOnly}
                            onClick={() => { setTypeFilter(f.key); setUnreadOnly(false) }}
                        />
                    ))}
                    <div className="h-5 w-px bg-gray-200 mx-1 shrink-0" />
                    <FilterPill
                        label="Unread only"
                        active={unreadOnly}
                        count={unreadCount}
                        onClick={() => setUnreadOnly(v => !v)}
                    />
                </div>

                {/* ── Bulk actions bar ── */}
                {selected.size > 0 && (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5 gap-3">
                        <div className="flex items-center gap-2.5">
                            <button onClick={toggleAll} className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
                                <div className={`h-4 w-4 rounded border-2 flex items-center justify-center ${allSelected ? 'bg-blue-600 border-blue-600' : 'border-blue-400'}`}>
                                    {allSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                </div>
                                {selected.size} selected
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={bulkMarkRead}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                <Check size={12} /> Mark read
                            </button>
                            <button
                                onClick={() => setSelected(new Set())}
                                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Notification list ── */}
                {loading ? (
                    <div className="space-y-2.5">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-start gap-4 px-5 py-4 bg-white rounded-2xl border border-gray-100 animate-pulse">
                                <div className="h-11 w-11 rounded-2xl bg-gray-100 shrink-0" />
                                <div className="flex-1 space-y-2 pt-1">
                                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                                    <div className="h-3 bg-gray-100 rounded w-1/5" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-20 w-20 bg-gray-50 rounded-3xl flex items-center justify-center mb-4 border border-gray-100">
                            <Inbox size={32} className="text-gray-300" />
                        </div>
                        <p className="text-base font-semibold text-gray-700">No notifications</p>
                        <p className="text-sm text-gray-400 mt-1">
                            {unreadOnly ? "You're all caught up!" : typeFilter !== 'all' ? 'No matching notifications' : "Nothing here yet"}
                        </p>
                        {(unreadOnly || typeFilter !== 'all') && (
                            <button
                                onClick={() => { setTypeFilter('all'); setUnreadOnly(false) }}
                                className="mt-3 text-sm text-blue-600 hover:underline font-medium"
                            >
                                Show all notifications
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Select all row */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700 select-none">
                                <div
                                    onClick={toggleAll}
                                    className={`h-4 w-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all
                                                ${allSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
                                >
                                    {allSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                </div>
                                Select all
                            </label>
                            <p className="text-xs text-gray-400">{notifications.length} shown</p>
                        </div>

                        {Object.entries(groups).map(([label, items]) => {
                            if (!items.length) return null
                            return (
                                <DateGroup key={label} label={label}>
                                    {items.map(n => (
                                        <NotificationCard
                                            key={n.id}
                                            n={n}
                                            selected={selected.has(n.id)}
                                            onSelect={toggleSelect}
                                            onMarkRead={markRead}
                                            onDelete={deleteOne}
                                        />
                                    ))}
                                </DateGroup>
                            )
                        })}

                        {/* Load more */}
                        {hasMore && (
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={() => load(page + 1, true)}
                                    disabled={loadingMore}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:text-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {loadingMore
                                        ? <><div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> Loading…</>
                                        : <><ChevronDown size={15} /> Load more</>
                                    }
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
