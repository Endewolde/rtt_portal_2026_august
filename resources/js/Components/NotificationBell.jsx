import { useState, useEffect, useRef, useCallback } from 'react'
import { translate as tr } from '../lib/i18n'
import { createPortal }  from 'react-dom'
import { Link }          from '@inertiajs/react'
import { router }        from '@inertiajs/react'
import {
    Bell, X, Check, CheckCheck, ChevronRight,
    FileText, FileCheck, DollarSign, Trophy,
    ClipboardList, CheckCircle2, XCircle,
    AlertTriangle, AlertCircle, Calendar, MessageSquare,
    Users, PenLine, Inbox, Trash2, Zap, Sparkles } from 'lucide-react'
import { get, post, del } from '../lib/api'
import { timeAgo } from '../lib/utils'

// ─── Notification type registry ────────────────────────────────────────────────

const TYPE_CFG = {
    submission_success: {
        icon: FileCheck, color: 'blue', label: 'Submission Received', category: 'activity',
        template: d => `Proposal ${d.tracker_number || ''} submitted successfully`,
        actionLabel: 'View Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals',
    },
    budget_allocated: {
        icon: DollarSign, color: 'emerald', label: 'Budget Allocated', category: 'activity',
        template: d => `Budget allocated for ${d.tracker_number || 'your proposal'}`,
        actionLabel: 'View Budget', actionUrl: () => '/budget',
    },
    award_approval: {
        icon: Trophy, color: 'yellow', label: 'Award Approved', category: 'activity',
        template: d => `Proposal ${d.tracker_number || ''} has been awarded`,
        actionLabel: 'View Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals',
    },
    review_assignment: {
        icon: ClipboardList, color: 'indigo', label: 'Review Assigned', category: 'action',
        template: d => `Assigned to review ${d.tracker_number || ''} — ${d.review_type || ''}`,
        actionLabel: 'Review Now', actionUrl: () => '/proposals/reviewee',
    },
    review_assignment_cancelled: {
        icon: XCircle, color: 'gray', label: 'Assignment Cancelled', category: 'activity',
        template: d => `Your review assignment for ${d.tracker_number || ''} was cancelled — the proposal was rejected`,
        actionLabel: null, actionUrl: () => '/notifications',
    },
    review_deadline_reminder: {
        icon: AlertTriangle, color: 'amber', label: 'Review Deadline Reminder', category: 'action',
        template: d => (d.days_remaining ?? 0) < 0
            ? `Review for ${d.tracker_number || ''} is overdue`
            : `Review for ${d.tracker_number || ''} due ${d.due_date || 'soon'}`,
        actionLabel: 'Review Now', actionUrl: () => '/proposals/reviewee',
    },
    proposal_approved: {
        icon: CheckCircle2, color: 'green', label: 'Proposal Approved', category: 'activity',
        template: d => `Proposal ${d.tracker_number || ''} has been approved`,
        actionLabel: 'View Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals',
    },
    proposal_rejected: {
        icon: XCircle, color: 'red', label: 'Proposal Rejected', category: 'activity',
        template: d => `Proposal ${d.tracker_number || ''} was not approved`,
        actionLabel: 'View Details', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals',
    },
    central_eval_approved: {
        icon: CheckCircle2, color: 'green', label: 'Advanced to Central Evaluation', category: 'activity',
        template: d => `Your proposal ${d.tracker_number || ''} passed open defence and is now in Central Evaluation`,
        actionLabel: 'View Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals',
    },
    blind_review_passed_officer: {
        icon: Calendar, color: 'violet', label: 'Open Defence Needed', category: 'action',
        template: d => `Proposal ${d.tracker_number || ''} passed blind review — schedule an open defence session`,
        actionLabel: 'Schedule Defence', actionUrl: () => '/admin/open-defence',
    },
    central_eval_ready_officer: {
        icon: CheckCircle2, color: 'blue', label: 'Central Evaluation Needed', category: 'action',
        template: d => `Proposal ${d.tracker_number || ''} passed open defence — make the funding decision`,
        actionLabel: 'Open Central Evaluation', actionUrl: () => '/admin/central-evaluation',
    },
    decision_result: {
        icon: Bell, color: 'gray', label: 'Decision Update', category: 'activity',
        template: d => d.title || `Decision on ${d.tracker_number || 'proposal'}`,
        actionLabel: 'View Details', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals',
    },
    proposal_submitted_officer: {
        icon: Inbox, color: 'blue', label: 'New Submission', category: 'action',
        template: d => `New proposal submitted: ${d.tracker_number || ''}`,
        actionLabel: 'Review', actionUrl: () => '/proposals',
    },
    budget_request_approved: {
        icon: DollarSign, color: 'teal', label: 'Budget Approved', category: 'activity',
        template: d => `Budget request (Round ${d.round_number || 1}) approved for ${d.tracker_number || ''}`,
        actionLabel: 'View Budget', actionUrl: () => '/budget',
    },
    funding_revoked: {
        icon: AlertTriangle, color: 'red', label: 'Funding Revoked', category: 'activity',
        template: d => `Funding revoked for ${d.tracker_number || ''}`,
        actionLabel: 'View Details', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals',
    },
    signature_required: {
        icon: PenLine, color: 'amber', label: 'Signature Required', category: 'action',
        template: d => `Signature required for ${d.tracker_number || ''}`,
        actionLabel: 'Sign Now', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals',
    },
    midterm_scheduled: {
        icon: Calendar, color: 'blue', label: 'M&E Scheduled', category: 'activity',
        template: d => `Midterm evaluation scheduled for ${d.tracker_number || ''} on ${d.evaluation_date || ''}`,
        actionLabel: 'View', actionUrl: () => '/midterm-evaluations',
    },
    midterm_report_submitted: {
        icon: FileText, color: 'purple', label: 'M&E Report Ready', category: 'action',
        template: d => `Midterm report submitted for ${d.tracker_number || ''}. Ready to score.`,
        actionLabel: 'Score Now', actionUrl: () => '/midterm-evaluations',
    },
    midterm_hold: {
        icon: AlertTriangle, color: 'red', label: 'M&E Hold', category: 'activity',
        template: d => `Midterm evaluation on hold for ${d.tracker_number || ''} from ${d.college || ''}`,
        actionLabel: 'View', actionUrl: () => '/midterm-evaluations',
    },
    workshop_scheduled: {
        icon: Calendar, color: 'violet', label: 'Workshop Scheduled', category: 'activity',
        template: d => `Completion workshop on ${d.date || ''} at ${d.venue || ''}`,
        actionLabel: 'View Workshop', actionUrl: () => '/completion-workshops',
    },
    complaint_response: {
        icon: MessageSquare, color: 'orange', label: 'Complaint Response', category: 'activity',
        template: d => `Complaint ${d.resolution || 'updated'} for ${d.tracker_number || ''}`,
        actionLabel: 'View Complaint', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals',
    },
    complaint_filed: {
        icon: AlertCircle, color: 'red', label: 'Complaint Filed', category: 'activity',
        template: d => `Complaint filed for ${d.tracker_number || ''}`,
        actionLabel: 'View', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals',
    },
    output_recorded: {
        icon: FileCheck, color: 'indigo', label: 'Output Recorded', category: 'activity',
        template: d => `Research output recorded for ${d.tracker_number || ''}`,
        actionLabel: 'View', actionUrl: () => '/proposals',
    },
    co_investigator_notified: {
        icon: Users, color: 'blue', label: 'Co-Investigator', category: 'activity',
        template: d => `Added as co-investigator on ${d.tracker_number || ''}`,
        actionLabel: 'View Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals',
    },
    co_pi_response: {
        icon: MessageSquare, color: 'blue', label: 'Co-PI Response', category: 'activity',
        template: d => `${d.co_pi_name || 'Your co-investigator'} ${d.response === 'accepted' ? 'accepted' : 'declined'} your invitation on ${d.tracker_number || ''}`,
        actionLabel: 'View', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/proposals',
    },
    'App\\Notifications\\SystemAlertNotification': {
        icon: AlertCircle, color: 'amber', label: 'System Alert', category: 'activity',
        template: d => d.message || d.title || 'System notification',
        actionLabel: null, actionUrl: () => '/notifications',
    },
    progress_report_due: {
        icon: Calendar, color: 'amber', label: 'Progress Report Due', category: 'action',
        template: d => d.message || 'Progress Report Due',
        actionLabel: 'Open Reports', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Progress` : '/progress-reports',
    },
    progress_report_overdue: {
        icon: AlertCircle, color: 'red', label: 'Progress Report Overdue', category: 'action',
        template: d => d.message || 'Progress Report Overdue',
        actionLabel: 'Open Reports', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Progress` : '/progress-reports',
    },
    progress_report_submitted: {
        icon: ClipboardList, color: 'blue', label: 'Progress Report Submitted', category: 'action',
        template: d => d.message || 'Progress Report Submitted',
        actionLabel: 'Review Report', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Progress` : '/progress-reports',
    },
    progress_report_reviewed: {
        icon: CheckCircle2, color: 'green', label: 'Progress Report Reviewed', category: 'activity',
        template: d => d.message || 'Progress Report Reviewed',
        actionLabel: 'Open Reports', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Progress` : '/progress-reports',
    },
    data_deletion_requested: {
        icon: AlertTriangle, color: 'amber', label: 'Data Deletion Request', category: 'action',
        template: d => d.message || 'Someone asked for their personal data to be deleted',
        actionLabel: 'Review Request', actionUrl: () => '/admin/data-requests',
    },
    data_deletion_reviewed: {
        icon: AlertTriangle, color: 'blue', label: 'Data Deletion Request', category: 'activity',
        template: d => d.message || 'Your data deletion request was reviewed',
        actionLabel: 'Open Profile', actionUrl: () => '/profile',
    },
    review_certificate_released: {
        icon: Trophy, color: 'yellow', label: 'Certificate Ready', category: 'activity',
        template: d => d.message || 'Your certificate of review service is ready',
        actionLabel: 'Open My Reviews', actionUrl: () => '/reviews',
    },
    review_certificate_revoked: {
        icon: AlertTriangle, color: 'red', label: 'Certificate Revoked', category: 'activity',
        template: d => d.message || 'Your certificate of review service was revoked',
        actionLabel: 'Open My Reviews', actionUrl: () => '/reviews',
    },
    mentorship_requested: {
        icon: Users, color: 'violet', label: 'Mentorship Request', category: 'action',
        template: d => d.message || 'Someone asked you to be their mentor',
        actionLabel: 'Open Mentorship', actionUrl: () => '/mentorship',
    },
    mentorship_accepted: {
        icon: Users, color: 'emerald', label: 'Mentorship Accepted', category: 'activity',
        template: d => d.message || 'Your mentorship request was accepted',
        actionLabel: 'Open Mentorship', actionUrl: () => '/mentorship',
    },
    mentorship_declined: {
        icon: Users, color: 'gray', label: 'Mentorship Request', category: 'activity',
        template: d => d.message || 'Your mentorship request was declined',
        actionLabel: 'Open Mentorship', actionUrl: () => '/mentorship',
    },
    opportunity_match: {
        icon: Sparkles, color: 'emerald', label: 'Funding Opportunity', category: 'activity',
        template: d => d.message || 'A funding opportunity matches your work',
        actionLabel: 'See opportunities', actionUrl: () => '/funding-opportunities',
    },
    proposal_message: {
        icon: MessageSquare, color: 'indigo', label: 'New Message', category: 'action',
        template: d => d.message || 'You have a new message about a proposal',
        actionLabel: 'Open Messages', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}?tab=Messages` : '/notifications',
    },
    risk_digest: {
        icon: AlertTriangle, color: 'red', label: 'Projects at Risk', category: 'action',
        template: d => d.message || 'Some funded projects need attention',
        actionLabel: 'Open Projects at Risk', actionUrl: () => '/projects-at-risk?level=high',
    },
    project_health_warning: {
        icon: AlertTriangle, color: 'amber', label: 'Project Needs Attention', category: 'action',
        template: d => d.message || 'Your project needs attention',
        actionLabel: 'Open Project', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-proposals',
    },
    review_certificate_withdrawn: {
        icon: AlertTriangle, color: 'amber', label: 'Certificates Withdrawn', category: 'activity',
        template: d => d.message || 'Certificates of review service were withdrawn',
        actionLabel: 'Open My Reviews', actionUrl: () => '/reviews',
    },
    broadcast: {
        icon: Bell, color: 'indigo', label: 'Announcement', category: 'activity',
        template: d => d.title ? `${d.title}${d.message ? ` — ${d.message}` : ''}` : (d.message || 'New announcement'),
        actionLabel: null, actionUrl: () => '/notifications',
    },
    contract_reminder: {
        icon: PenLine, color: 'amber', label: 'Contract Needed', category: 'action',
        template: d => d.message || `Upload the signed contract for ${d.tracker_number || 'your project'}`,
        actionLabel: 'Open Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/my-research',
    },
    contract_escalation: {
        icon: AlertTriangle, color: 'red', label: 'Contract Overdue', category: 'action',
        template: d => d.message || `The contract for ${d.tracker_number || 'a project'} is long overdue`,
        actionLabel: 'Open Awarded', actionUrl: () => '/admin/awarded',
    },
    stage_escalation: {
        icon: AlertTriangle, color: 'red', label: 'Escalation', category: 'action',
        template: d => d.message || `${d.tracker_number || 'A proposal'} is long overdue`,
        actionLabel: 'Open Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/admin/turnaround',
    },
    stage_reminder: {
        icon: AlertTriangle, color: 'amber', label: 'Action Needed', category: 'action',
        template: d => d.message || `${d.tracker_number || 'A proposal'} is waiting on you`,
        actionLabel: 'Open Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/notifications',
    },
    review_disagreement: {
        icon: AlertTriangle, color: 'amber', label: 'Reviewers Disagree', category: 'action',
        template: d => d.message || `Blind reviewers disagree on ${d.tracker_number || 'a proposal'}`,
        actionLabel: 'Open Proposal', actionUrl: d => d.proposal_id ? `/proposals/${d.proposal_id}` : '/admin/blind-review',
    },
    defence_extension_requested: {
        icon: Calendar, color: 'amber', label: 'Defence Deadline Extension Request', category: 'action',
        template: d => d.message || `Score deadline extension requested for ${d.tracker_number || 'a proposal'}`,
        actionLabel: 'Review Request', actionUrl: () => '/admin/defence-extensions',
    },
    defence_extension_resolved: {
        icon: Calendar, color: 'violet', label: 'Defence Extension Decision', category: 'activity',
        template: d => d.message || `Your extension request for ${d.tracker_number || 'a proposal'} was ${d.decision || 'decided'}`,
        actionLabel: 'Open Defence', actionUrl: () => '/admin/open-defence',
    },
    defence_deadline_extended: {
        icon: Calendar, color: 'violet', label: 'Defence Deadline Extended', category: 'action',
        template: d => d.message || `The defence score deadline for ${d.tracker_number || 'a proposal'} was extended`,
        actionLabel: 'My Reviews', actionUrl: () => '/reviews',
    },
    defence_deadline_reminder: {
        icon: AlertTriangle, color: 'amber', label: 'Defence Score Due', category: 'action',
        template: d => d.message || `Your defence score for ${d.tracker_number || 'a proposal'} is due soon`,
        actionLabel: 'My Reviews', actionUrl: () => '/reviews',
    },
    defence_deadline_passed: {
        icon: AlertCircle, color: 'red', label: 'Defence Deadline Passed', category: 'action',
        template: d => d.message || `The defence score deadline for ${d.tracker_number || 'a proposal'} has passed`,
        actionLabel: 'Open Defence', actionUrl: () => '/admin/open-defence',
    },
    default: {
        icon: Bell, color: 'gray', label: 'Notification', category: 'activity',
        template: d => d.message || d.title || 'New notification',
        actionLabel: null, actionUrl: () => '/notifications',
    },
}

const COLORS = {
    blue:    { icon: 'bg-blue-100 text-blue-600',     border: 'border-l-blue-500',    progress: 'bg-blue-400',    badge: 'text-blue-700 bg-blue-50'    },
    emerald: { icon: 'bg-emerald-100 text-emerald-600', border: 'border-l-emerald-500', progress: 'bg-emerald-400', badge: 'text-emerald-700 bg-emerald-50' },
    green:   { icon: 'bg-green-100 text-green-600',   border: 'border-l-green-500',   progress: 'bg-green-400',   badge: 'text-green-700 bg-green-50'   },
    yellow:  { icon: 'bg-yellow-100 text-yellow-600', border: 'border-l-yellow-500',  progress: 'bg-yellow-400',  badge: 'text-yellow-700 bg-yellow-50'  },
    amber:   { icon: 'bg-amber-100 text-amber-600',   border: 'border-l-amber-500',   progress: 'bg-amber-400',   badge: 'text-amber-700 bg-amber-50'   },
    red:     { icon: 'bg-red-100 text-red-600',       border: 'border-l-red-500',     progress: 'bg-red-400',     badge: 'text-red-700 bg-red-50'       },
    indigo:  { icon: 'bg-indigo-100 text-indigo-600', border: 'border-l-indigo-500',  progress: 'bg-indigo-400',  badge: 'text-indigo-700 bg-indigo-50'  },
    purple:  { icon: 'bg-purple-100 text-purple-600', border: 'border-l-purple-500',  progress: 'bg-purple-400',  badge: 'text-purple-700 bg-purple-50'  },
    violet:  { icon: 'bg-violet-100 text-violet-600', border: 'border-l-violet-500',  progress: 'bg-violet-400',  badge: 'text-violet-700 bg-violet-50'  },
    teal:    { icon: 'bg-teal-100 text-teal-600',     border: 'border-l-teal-500',    progress: 'bg-teal-400',    badge: 'text-teal-700 bg-teal-50'     },
    orange:  { icon: 'bg-orange-100 text-orange-600', border: 'border-l-orange-500',  progress: 'bg-orange-400',  badge: 'text-orange-700 bg-orange-50'  },
    gray:    { icon: 'bg-gray-100 text-gray-500',     border: 'border-l-gray-400',    progress: 'bg-gray-400',    badge: 'text-gray-600 bg-gray-100'     },
}

export function getCfg(type)   { return TYPE_CFG[type] ?? TYPE_CFG.default }
export function getColors(type) { return COLORS[getCfg(type).color] ?? COLORS.gray }
export function getMessage(type, data) { return getCfg(type).template(data ?? {}) }
export function getActionUrl(type, data) { return getCfg(type).actionUrl(data ?? {}) }

function groupByDate(items) {
    const today     = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const groups    = { Today: [], Yesterday: [], Earlier: [] }
    for (const n of items) {
        const d = new Date(n.created_at); d.setHours(0, 0, 0, 0)
        if (d >= today)          groups.Today.push(n)
        else if (d >= yesterday) groups.Yesterday.push(n)
        else                     groups.Earlier.push(n)
    }
    return groups
}

// ─── Toast notification popup ──────────────────────────────────────────────────

const TOAST_DURATION = 6500

function Toast({ toast, onDismiss }) {
    const [visible,  setVisible]  = useState(false)
    const [progress, setProgress] = useState(100)
    const cfg    = getCfg(toast.type)
    const colors = getColors(toast.type)
    const Icon   = cfg.icon
    const msg    = getMessage(toast.type, toast.data)
    const url    = getActionUrl(toast.type, toast.data)

    const dismiss = useCallback(() => {
        setVisible(false)
        setTimeout(() => onDismiss(toast.toastId), 280)
    }, [toast.toastId, onDismiss])

    // Slide up on mount
    useEffect(() => {
        const tid = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
        return () => cancelAnimationFrame(tid)
    }, [])

    // Drain progress bar with rAF
    useEffect(() => {
        const start = Date.now()
        let rafId
        const tick = () => {
            const p = Math.max(0, 100 * (1 - (Date.now() - start) / TOAST_DURATION))
            setProgress(p)
            if (p > 0) { rafId = requestAnimationFrame(tick) }
        }
        rafId = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafId)
    }, [])

    // Auto-dismiss
    useEffect(() => {
        const tid = setTimeout(dismiss, TOAST_DURATION)
        return () => clearTimeout(tid)
    }, [dismiss])

    const navigate = () => { router.visit(url); dismiss() }

    return (
        <div
            className={`w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 border-l-4 ${colors.border}
                        overflow-hidden cursor-pointer
                        transition-all duration-280 ease-out
                        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
            onClick={navigate}
        >
            {/* Drain bar */}
            <div className="h-0.5 bg-gray-100">
                <div
                    className={`h-full ${colors.progress} transition-none`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex items-start gap-3 p-3.5">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                    <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                    {cfg.category === 'action' && (
                        <div className="flex items-center gap-1 mb-0.5">
                            <Zap size={10} className="text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">{tr("Action required")}</span>
                        </div>
                    )}
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${colors.badge.split(' ')[0]}`}>{cfg.label}</p>
                    <p className="text-sm text-gray-800 mt-0.5 leading-tight line-clamp-2">{msg}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(toast.created_at)}</p>
                </div>
                <button
                    onClick={e => { e.stopPropagation(); dismiss() }}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
                >
                    <X size={13} />
                </button>
            </div>
        </div>
    )
}

function ToastStack({ toasts, onDismiss }) {
    if (!toasts.length) return null
    return createPortal(
        <div className="fixed bottom-5 right-5 z-9999 flex flex-col gap-2.5 items-end pointer-events-none">
            {toasts.map(t => (
                <div key={t.toastId} className="pointer-events-auto">
                    <Toast toast={t} onDismiss={onDismiss} />
                </div>
            ))}
        </div>,
        document.body
    )
}

// ─── Notification item (inside drawer) ────────────────────────────────────────

function DrawerItem({ n, onMarkRead, onClose }) {
    const cfg    = getCfg(n.type)
    const colors = getColors(n.type)
    const Icon   = cfg.icon
    const msg    = getMessage(n.type, n.data)
    const url    = getActionUrl(n.type, n.data)
    const isUnread = !n.read_at

    const navigate = () => {
        router.visit(url)
        onClose()
        if (isUnread) onMarkRead([n.id])
    }

    return (
        <div
            className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors
                        ${isUnread ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
            onClick={navigate}
        >
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${colors.icon}`}>
                <Icon size={15} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${colors.badge}`}>
                        {cfg.label}
                    </span>
                    {cfg.category === 'action' && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                            <Zap size={9} /> {tr("Pending")}
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-800 leading-snug line-clamp-2">{msg}</p>
                <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                {isUnread && (
                    <>
                        <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        <button
                            onClick={e => { e.stopPropagation(); onMarkRead([n.id]) }}
                            title={tr("Mark as read")}
                            className="p-1 rounded-lg hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Check size={11} />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

// ─── Drawer panel ─────────────────────────────────────────────────────────────

function DrawerPanel({ open, onClose, notifications, loading, unreadCount, onMarkRead, onMarkAllRead, onLoadMore, hasMore }) {
    useEffect(() => {
        if (!open) return
        document.body.style.overflow = 'hidden'
        const esc = e => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', esc)
        return () => {
            document.body.style.overflow = ''
            document.removeEventListener('keydown', esc)
        }
    }, [open, onClose])

    const groups = groupByDate(notifications)
    const actionRequired = notifications.filter(n => getCfg(n.type).category === 'action' && !n.read_at)

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40 transition-opacity duration-300
                            ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Slide-in panel */}
            <div
                className={`fixed inset-y-0 right-0 w-full sm:w-105 bg-white shadow-2xl z-50 flex flex-col
                            transition-transform duration-300 ease-in-out
                            ${open ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* ── Header ── */}
                <div className="bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 px-5 pt-5 pb-4 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-white/20 rounded-xl flex items-center justify-center">
                                <Bell size={17} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-base leading-none">{tr("Notifications")}</h2>
                                <p className="text-blue-200 text-xs mt-0.5">
                                    {unreadCount > 0 ? `${unreadCount} unread` : '✓ All caught up'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {unreadCount > 0 && (
                                <button
                                    onClick={onMarkAllRead}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl transition-colors"
                                >
                                    <CheckCheck size={12} /> {tr("Mark all read")}
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Pending actions summary */}
                    {actionRequired.length > 0 && (
                        <div className="flex items-center gap-2 bg-amber-400/20 border border-amber-300/30 rounded-xl px-3 py-2">
                            <Zap size={13} className="text-amber-300 shrink-0" />
                            <p className="text-amber-100 text-xs font-semibold">
                                {actionRequired.length} action{actionRequired.length !== 1 ? 's' : ''} pending your attention
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                    {loading && notifications.length === 0 ? (
                        <div className="space-y-0">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-start gap-3 px-4 py-3.5 animate-pulse">
                                    <div className="h-9 w-9 rounded-xl bg-gray-100 shrink-0" />
                                    <div className="flex-1 space-y-1.5 pt-1">
                                        <div className="h-3 bg-gray-100 rounded w-1/3" />
                                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                                        <div className="h-2.5 bg-gray-100 rounded w-1/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                            <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                                <Inbox size={28} className="text-blue-300" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700">{tr("All caught up!")}</p>
                            <p className="text-xs text-gray-400 mt-1">{tr("No notifications yet. We'll let you know when something happens.")}</p>
                        </div>
                    ) : (
                        Object.entries(groups).map(([label, items]) => {
                            if (!items.length) return null
                            return (
                                <div key={label}>
                                    <div className="sticky top-0 px-4 py-2 bg-gray-50 border-b border-gray-100 z-10">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                                    </div>
                                    {items.map(n => (
                                        <DrawerItem key={n.id} n={n} onMarkRead={onMarkRead} onClose={onClose} />
                                    ))}
                                </div>
                            )
                        })
                    )}

                    {hasMore && !loading && (
                        <div className="px-4 py-4 text-center">
                            <button
                                onClick={onLoadMore}
                                className="text-sm text-blue-600 hover:underline font-semibold"
                            >
                                Load more
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">{tr(":notifications_count loaded", { notifications_count: notifications.length })}</p>
                    <Link
                        href="/notifications"
                        onClick={onClose}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                        View all notifications <ChevronRight size={12} />
                    </Link>
                </div>
            </div>
        </>,
        document.body
    )
}

// ─── Main export: bell button + drawer + toasts ────────────────────────────────

export default function NotificationBell({ onCountChange }) {
    const [unreadCount,    setUnreadCount]    = useState(0)
    const [notifications,  setNotifications]  = useState([])
    const [drawerOpen,     setDrawerOpen]     = useState(false)
    const [loading,        setLoading]        = useState(false)
    const [toasts,         setToasts]         = useState([])
    const [page,           setPage]           = useState(1)
    const [hasMore,        setHasMore]        = useState(false)

    const seenIdsRef     = useRef(new Set())
    const prevCountRef   = useRef(null)
    const isFirstPollRef = useRef(true)
    const drawerOpenRef  = useRef(false)

    drawerOpenRef.current = drawerOpen

    const syncCount = useCallback((count) => {
        setUnreadCount(count)
        onCountChange?.(count)
    }, [onCountChange])

    // ── Background polling ──
    const poll = useCallback(async () => {
        try {
            const r     = await get('/notifications/unread-count')
            const count = r.data?.count ?? 0
            const prev  = prevCountRef.current
            prevCountRef.current = count
            syncCount(count)

            if (isFirstPollRef.current) {
                // Seed seen IDs from current unread so we never toast for stale items
                isFirstPollRef.current = false
                const r2    = await get('/notifications', { unread: 1, per_page: 50 })
                const items = r2.data ?? []
                items.forEach(n => seenIdsRef.current.add(n.id))
                return
            }

            if (prev !== null && count > prev && !drawerOpenRef.current) {
                const r2    = await get('/notifications', { unread: 1, per_page: Math.min(count - prev + 2, 5) })
                const items = r2.data ?? []
                const fresh = items.filter(n => !seenIdsRef.current.has(n.id))
                if (fresh.length) {
                    fresh.forEach(n => seenIdsRef.current.add(n.id))
                    setToasts(prev => [
                        ...fresh.slice(0, 3).map(n => ({ ...n, toastId: `${n.id}-${Date.now()}` })),
                        ...prev,
                    ].slice(0, 4))
                }
            }
        } catch {
            // silent
        }
    }, [syncCount])

    useEffect(() => {
        poll()
        const id = setInterval(poll, 22000)
        return () => clearInterval(id)
    }, [poll])

    // ── Load notifications for drawer ──
    const loadDrawer = useCallback(async (reset = false) => {
        if (loading && !reset) return
        setLoading(true)
        const p = reset ? 1 : page
        try {
            const r     = await get('/notifications', { page: p, per_page: 20 })
            const items = r.data ?? []
            const meta  = r.meta ?? {}
            if (reset) {
                setNotifications(items)
                setPage(2)
            } else {
                setNotifications(prev => [...prev, ...items])
                setPage(p + 1)
            }
            setHasMore((meta.current_page ?? 1) < (meta.last_page ?? 1))
        } catch {
            // silent
        }
        setLoading(false)
    }, [loading, page])

    const openDrawer = () => {
        setDrawerOpen(true)
        loadDrawer(true)
    }

    // ── Mark read ──
    const markRead = useCallback(async (ids) => {
        await post('/notifications/read', { ids }).catch(() => {})
        setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
        syncCount(Math.max(0, unreadCount - ids.length))
    }, [unreadCount, syncCount])

    const markAllRead = useCallback(async () => {
        await post('/notifications/read-all', {}).catch(() => {})
        setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
        syncCount(0)
    }, [syncCount])

    const dismissToast = useCallback((toastId) => {
        setToasts(prev => prev.filter(t => t.toastId !== toastId))
    }, [])

    return (
        <>
            {/* ── Bell button ── */}
            <button
                onClick={openDrawer}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors group"
                title={tr("Notifications")}
            >
                <Bell
                    size={20}
                    className={`transition-colors ${unreadCount > 0 ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`}
                />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 flex items-center justify-center
                                     rounded-full bg-red-500 text-[10px] font-bold text-white
                                     ring-2 ring-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* ── Slide-in drawer ── */}
            <DrawerPanel
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                notifications={notifications}
                loading={loading}
                unreadCount={unreadCount}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
                onLoadMore={() => loadDrawer()}
                hasMore={hasMore}
            />

            {/* ── Toast stack (bottom-right) ── */}
            <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </>
    )
}
