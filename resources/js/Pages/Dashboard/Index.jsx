import { useState, useEffect } from 'react'
import { translate as tr } from '../../lib/i18n'
import { Link } from '@inertiajs/react'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
    FileText, Megaphone, Search, Award, DollarSign,
    TrendingUp, ArrowUpRight, ArrowDownRight,
    Bell, ChevronRight, Calendar, Building2, BookOpen,
    ClipboardCheck, AlertCircle, Clock, CheckCircle2,
    Activity, BarChart2,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import api from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { usePage } from '@inertiajs/react'
import { formatCurrency, getStatusColor, getStatusLabel, timeAgo, cn } from '../../lib/utils'
import { roleLabel, rememberRoleLabels } from '../../lib/roles';
import { programmes, programmeColor, programmeLabel } from '../../lib/programmes';
import { getCfg, getColors, getMessage, getActionUrl } from '../../Components/NotificationBell';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
}

const STATUS_LABEL = {
    draft:              'Draft',
    submitted:          'Submitted',
    validated:          'Validated',
    under_blind_review: 'Blind Review',
    blind_review_passed:'Review Passed',
    under_open_defence: 'Open Defence',
    accepted:           'Central Evaluation',
    funded:             'Funded',
    midterm_evaluation: 'Midterm',
    completed:          'Completed',
    rejected:           'Rejected',
    archived:           'Archived',
}

/** One colour per stage, so a stage keeps its colour as others come and go. */
const STATUS_COLOR = {
    draft: '#cbd5e1', submitted: '#93c5fd', validated: '#60a5fa', under_blind_review: '#6366f1',
    blind_review_passed: '#818cf8', under_open_defence: '#a855f7', accepted: '#f59e0b', funded: '#10b981',
    midterm_evaluation: '#14b8a6', completed: '#059669', archived: '#64748b', rejected: '#ef4444',
}

const CARD_COLORS = {
    indigo:  { border: 'border-l-4 border-l-indigo-500',  iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600'  },
    emerald: { border: 'border-l-4 border-l-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    purple:  { border: 'border-l-4 border-l-purple-500',  iconBg: 'bg-purple-50',  iconColor: 'text-purple-600'  },
    amber:   { border: 'border-l-4 border-l-amber-500',   iconBg: 'bg-amber-50',   iconColor: 'text-amber-600'   },
    blue:    { border: 'border-l-4 border-l-blue-500',    iconBg: 'bg-blue-50',    iconColor: 'text-blue-600'    },
    red:     { border: 'border-l-4 border-l-red-500',     iconBg: 'bg-red-50',     iconColor: 'text-red-600'     },
    teal:    { border: 'border-l-4 border-l-teal-500',    iconBg: 'bg-teal-50',    iconColor: 'text-teal-600'    },
    gray:    { border: 'border-l-4 border-l-gray-400',    iconBg: 'bg-gray-50',    iconColor: 'text-gray-500'    },
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
    return <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`} />
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, subLabel, icon: Icon, colorKey, trend, href, loading }) {
    const Tag = href ? Link : 'div'
    const colors = CARD_COLORS[colorKey] ?? CARD_COLORS.indigo
    return (
        <Tag href={href}
            className={cn(
                'bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2.5',
                'hover:shadow-md transition-all duration-200 relative overflow-hidden',
                href && 'group cursor-pointer',
                colors.border,
            )}>
            <div className="flex items-start justify-between">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', colors.iconBg)}>
                    <Icon size={16} className={colors.iconColor} />
                </div>
                <div className="flex items-center gap-2">
                    {trend != null && (
                        <span className={cn(
                            'flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full',
                            trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        )}>
                            {trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {Math.abs(trend)}%
                        </span>
                    )}
                    {href && (
                        <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    )}
                </div>
            </div>
            {loading ? (
                <>
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-24 mt-0.5" />
                </>
            ) : (
                <>
                    <div className="text-2xl font-bold text-gray-900 leading-none mt-1">{value ?? 0}</div>
                    <div>
                        <p className="text-sm font-semibold text-gray-700">{label}</p>
                        {subLabel && <p className="text-xs text-gray-400 mt-0.5">{subLabel}</p>}
                    </div>
                </>
            )}
        </Tag>
    )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, action, children, className = '' }) {
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                    {title && <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>}
                    {action}
                </div>
            )}
            {children}
        </div>
    )
}

// ─── Trend chart ─────────────────────────────────────────────────────────────

function TrendChart({ data, loading }) {
    const last6 = data.slice(-6)

    if (loading) return (
        <div className="px-5 pb-5 pt-2">
            <Skeleton className="h-52 w-full" />
        </div>
    )

    const hasData = last6.some(r => r.total > 0)
    if (!hasData) return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <BarChart2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">{tr("No submissions in the last 6 months")}</p>
        </div>
    )

    // Every programme the server counts (Female Call included), not a fixed three.
    const keys = Object.keys(last6[0] ?? {}).filter(k => k !== 'month' && k !== 'total')
    const shown = keys.filter(k => last6.some(r => r[k] > 0))
    const series = (shown.length ? shown : keys).map(k => ({ key: k, label: programmeLabel(k), color: programmeColor(k) }))

    return (
        <div className="px-3 pb-4">
            <ResponsiveContainer width="100%" height={210}>
                <BarChart data={last6} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap="32%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        cursor={{ fill: '#f9fafb' }}
                    />
                    {series.map(p => <Bar key={p.key} dataKey={p.key} name={p.label} stackId="programmes" fill={p.color} />)}
                </BarChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                {series.map(l => (
                    <div key={l.key} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                        <span className="text-[11px] text-gray-500">{l.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Pipeline donut ───────────────────────────────────────────────────────────

function PipelineDonut({ statusCounts, loading }) {
    const entries = Object.entries(statusCounts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ key: k, name: STATUS_LABEL[k] ?? getStatusLabel(k), value: v }))
        .sort((a, b) => Object.keys(STATUS_COLOR).indexOf(a.key) - Object.keys(STATUS_COLOR).indexOf(b.key))

    const total = entries.reduce((s, e) => s + e.value, 0)

    if (loading) return (
        <div className="flex justify-center py-6">
            <Skeleton className="h-36 w-36 rounded-full" />
        </div>
    )

    if (!total) return (
        <div className="py-8 text-center text-gray-400 text-sm">{tr("No proposals yet")}</div>
    )

    return (
        <div className="px-4 pb-4 space-y-4">
            {/* Donut with center text */}
            <div className="flex justify-center">
                <div className="relative w-35 h-35">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={entries} dataKey="value" cx="50%" cy="50%"
                                innerRadius={44} outerRadius={64} paddingAngle={2} startAngle={90} endAngle={-270}>
                                {entries.map(e => <Cell key={e.key} fill={STATUS_COLOR[e.key] ?? '#94a3b8'} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 11, border: '1px solid #e5e7eb' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-gray-800 leading-none">{total}</span>
                        <span className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{tr("Total")}</span>
                    </div>
                </div>
            </div>
            {/* Legend */}
            <div className="space-y-1.5">
                {entries.map(e => (
                    <div key={e.key} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: STATUS_COLOR[e.key] ?? '#94a3b8' }} />
                        <span className="text-xs text-gray-600 flex-1 truncate">{e.name}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-800">{e.value}</span>
                            <span className="text-[10px] text-gray-400">
                                {Math.round((e.value / total) * 100)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Budget summary ───────────────────────────────────────────────────────────

function BudgetSummary({ data, loading }) {
    const allocated = parseFloat(data?.total_allocated ?? 0)
    const awarded   = parseFloat(data?.total_awarded   ?? 0)
    const disbursed = parseFloat(data?.total_disbursed ?? 0)
    const settled   = parseFloat(data?.total_settled   ?? 0)
    const pct       = allocated > 0 ? Math.min(100, Math.round((disbursed / allocated) * 100)) : 0

    const rows = [
        { label: 'Allocated', value: allocated, color: 'bg-indigo-500', pct: allocated > 0 ? 100 : 0 },
        { label: 'Awarded to projects', value: awarded, color: 'bg-violet-500', pct: allocated > 0 ? Math.min(100, (awarded / allocated) * 100) : 0 },
        { label: 'Disbursed', value: disbursed, color: 'bg-emerald-500', pct: allocated > 0 ? Math.min(100, (disbursed / allocated) * 100) : 0 },
        { label: 'Settled',   value: settled,   color: 'bg-cyan-500',   pct: allocated > 0 ? Math.min(100, (settled   / allocated) * 100) : 0 },
    ]

    if (loading) return <div className="px-5 pb-5 pt-2"><Skeleton className="h-24 w-full" /></div>

    return (
        <div className="px-5 pb-5 pt-2 space-y-3">
            {rows.map(r => (
                <div key={r.label}>
                    <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-xs text-gray-500 font-medium">{r.label}</span>
                        <span className="text-xs font-bold text-gray-800">{formatCurrency(r.value)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${r.color} rounded-full transition-all duration-500`}
                            style={{ width: `${r.pct}%` }} />
                    </div>
                </div>
            ))}
            {allocated > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                    <span className="text-xs text-gray-400">{tr("Disbursement rate")}</span>
                    <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full',
                        pct >= 80 ? 'bg-green-50 text-green-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'
                    )}>{pct}%</span>
                </div>
            )}
        </div>
    )
}

// ─── Pending tasks ────────────────────────────────────────────────────────────

const TASK_DEFS = {
    awaiting_validation:       { label: 'Awaiting Validation',  href: '/admin/validation-queue',     icon: ClipboardCheck, colorKey: 'blue'    },
    blind_review_in_progress:  { label: 'Blind Review',          href: '/admin/blind-review',         icon: Search,         colorKey: 'purple'  },
    open_defence_pending:      { label: 'Open Defence',          href: '/admin/open-defence',         icon: Megaphone,      colorKey: 'indigo'  },
    central_evaluation_pending:{ label: 'Central Evaluation',    href: '/admin/central-evaluation',   icon: Award,          colorKey: 'indigo'  },
    open_complaints:           { label: 'Open Complaints',       href: '/complaints',                 icon: AlertCircle,    colorKey: 'red'     },
    reviews_pending:           { label: 'Reviews Pending',       href: '/reviews',                    icon: ClipboardCheck, colorKey: 'amber'   },
    reviews_overdue:           { label: 'Overdue Reviews',       href: '/reviews',                    icon: AlertCircle,    colorKey: 'red'     },
    disbursements_pending:     { label: 'Disbursements',         href: '/disbursements',              icon: DollarSign,     colorKey: 'emerald' },
    settlements_to_finalize:   { label: 'Settlements',           href: '/settlements',                icon: FileText,       colorKey: 'teal'    },
    signatures_required:       { label: 'Signatures Required',   href: '/budget-requests',            icon: FileText,       colorKey: 'amber'   },
    drafts_in_progress:        { label: 'Draft Proposals',       href: '/my-proposals',               icon: FileText,       colorKey: 'gray'    },
    budget_requests_pending:   { label: 'Budget Requests',       href: '/budget-requests',            icon: DollarSign,     colorKey: 'emerald' },
    midterm_to_score:          { label: 'Midterm to Score',      href: '/midterm-evaluations',        icon: BookOpen,       colorKey: 'teal'    },
}

function PendingTasks({ tasks, loading }) {
    const items = Object.entries(tasks ?? {})
        .filter(([key]) => TASK_DEFS[key])
        .map(([key, count]) => ({ ...TASK_DEFS[key], count }))
        .sort((a, b) => b.count - a.count)

    if (loading) return (
        <div className="divide-y divide-gray-50">
            {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2.5 w-20" /></div>
                    <Skeleton className="h-6 w-8 rounded-full" />
                </div>
            ))}
        </div>
    )

    if (!items.length) return (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <CheckCircle2 size={32} className="mb-2 opacity-30 text-green-400" />
            <p className="text-sm font-medium text-gray-500">{tr("All caught up!")}</p>
            <p className="text-xs text-gray-400 mt-0.5">{tr("No pending actions")}</p>
        </div>
    )

    return (
        <div className="divide-y divide-gray-50">
            {items.map(task => {
                const Icon = task.icon
                const colors = CARD_COLORS[task.colorKey] ?? CARD_COLORS.indigo
                const isUrgent = task.count > 10
                const isWarning = task.count > 3 && task.count <= 10
                return (
                    <Link key={task.label} href={task.href}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', colors.iconBg)}>
                            <Icon size={15} className={colors.iconColor} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{task.label}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {task.count > 0 ? (
                                <span className={cn(
                                    'min-w-6 h-6 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5',
                                    isUrgent ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-gray-400'
                                )}>
                                    {task.count > 99 ? '99+' : task.count}
                                </span>
                            ) : (
                                <span className="h-6 w-6 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={13} />
                                </span>
                            )}
                            <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}

// ─── Notifications panel ──────────────────────────────────────────────────────

function NotificationsPanel({ notifications, loading }) {
    if (loading) return (
        <div className="divide-y divide-gray-50">
            {[1,2,3].map(i => (
                <div key={i} className="px-4 py-3.5 space-y-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-24" />
                </div>
            ))}
        </div>
    )

    if (!notifications?.length) return (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Bell size={28} className="mb-2 opacity-30" />
            <p className="text-sm">{tr("No new notifications")}</p>
        </div>
    )

    return (
        <div className="divide-y divide-gray-50">
            {notifications.slice(0, 6).map(n => {
                const cfg = getCfg(n.type)
                const Icon = cfg.icon
                // Same wording and link as the notification bell.
                const message = n.data?.message || getMessage(n.type, n.data)
                return (
                    <Link key={n.id} href={getActionUrl(n.type, n.data) || '/notifications'}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors">
                        <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', getColors(n.type).icon)}>
                            {Icon ? <Icon size={13} /> : <Bell size={13} />}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-gray-500">{cfg.label}</p>
                            <p className="line-clamp-2 text-xs leading-snug text-gray-800">{message}</p>
                            <p className="mt-0.5 text-[10px] text-gray-400">{timeAgo(n.created_at)}</p>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTION_COLORS = [
    { bg: 'bg-indigo-500 hover:bg-indigo-600', text: 'text-white' },
    { bg: 'bg-emerald-500 hover:bg-emerald-600', text: 'text-white' },
    { bg: 'bg-purple-500 hover:bg-purple-600', text: 'text-white' },
    { bg: 'bg-amber-500 hover:bg-amber-600', text: 'text-white' },
    { bg: 'bg-teal-500 hover:bg-teal-600', text: 'text-white' },
]

// Banner variant (small, white-on-gradient)
function QuickActionsBanner({ isAdmin, isPI, isReviewer, isFinance }) {
    const actions = isAdmin ? [
        { label: 'Validation Queue', href: '/admin/validation-queue', icon: ClipboardCheck },
        { label: 'Reports',          href: '/reports',                icon: BarChart2 },
        { label: 'Proposal Calls',   href: '/proposal-calls',        icon: Megaphone },
    ] : isPI ? [
        { label: 'New Application', href: '/proposals/create', icon: FileText },
        { label: 'My Proposals',    href: '/my-proposals',     icon: Activity },
        { label: 'Track Proposal',  href: '/tracker',          icon: Search },
    ] : isReviewer ? [
        { label: 'My Reviews', href: '/reviews', icon: ClipboardCheck },
    ] : isFinance ? [
        { label: 'Disbursements', href: '/disbursements', icon: DollarSign },
        { label: 'Settlements',   href: '/settlements',   icon: FileText },
    ] : []

    if (!actions.length) return null

    return (
        <div className="flex flex-wrap gap-2 mt-4">
            {actions.map(a => {
                const Icon = a.icon
                return (
                    <Link key={a.href} href={a.href}
                        className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20
                                   text-white text-xs font-semibold px-3 py-1.5 rounded-xl
                                   transition-all duration-150 hover:scale-[1.02] active:scale-95">
                        <Icon size={12} />
                        {a.label}
                    </Link>
                )
            })}
        </div>
    )
}

// Standalone card variant (prominent colored buttons)
function quickActions({ isAdmin, isPI, isReviewer, isFinance, isCollegeOfficer }) {
    const actions = isAdmin ? [
        { label: 'Validation Queue', href: '/admin/validation-queue', icon: ClipboardCheck },
        { label: 'Proposal Calls',   href: '/proposal-calls',        icon: Megaphone },
        { label: 'Reports',          href: '/reports',                icon: BarChart2 },
        { label: 'Blind Review',     href: '/admin/blind-review',     icon: Search },
        { label: 'Awarded',          href: '/admin/awarded',          icon: Award },
    ] : isPI ? [
        { label: 'New Application', href: '/proposals/create', icon: FileText },
        { label: 'My Proposals',    href: '/my-proposals',     icon: Activity },
        { label: 'Track Proposal',  href: '/tracker',          icon: Search },
    ] : isCollegeOfficer ? [
        { label: 'College Proposals', href: '/proposals',        icon: Building2 },
        { label: 'Budget Requests',   href: '/budget-requests',  icon: DollarSign },
    ] : isFinance ? [
        { label: 'Disbursements',   href: '/disbursements',    icon: DollarSign },
        { label: 'Settlements',     href: '/settlements',      icon: FileText },
    ] : []

    // Anyone with reviews to do gets a way straight to them.
    if (isReviewer && !actions.some(a => a.href === '/reviews')) {
        actions.unshift({ label: 'My Reviews', href: '/reviews', icon: ClipboardCheck })
    }

    return actions
}

function QuickActions({ actions }) {
    if (!actions.length) return null

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 px-5 pb-5 pt-2">
            {actions.map((a, i) => {
                const Icon = a.icon
                const col = QUICK_ACTION_COLORS[i % QUICK_ACTION_COLORS.length]
                return (
                    <Link key={a.href} href={a.href}
                        className={cn(
                            'flex flex-col items-center justify-center gap-2 rounded-xl py-4 px-3',
                            'transition-all duration-150 hover:scale-[1.03] active:scale-95 shadow-sm',
                            col.bg, col.text
                        )}>
                        <Icon size={18} />
                        <span className="text-xs font-semibold text-center leading-tight">{a.label}</span>
                    </Link>
                )
            })}
        </div>
    )
}

// ─── My Proposals list (PI) ───────────────────────────────────────────────────

function MyProposalsList({ proposals, loading, emptyText }) {
    if (loading) return (
        <div className="divide-y divide-gray-50">
            {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                </div>
            ))}
        </div>
    )

    if (!proposals?.length) return (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <FileText size={28} className="mb-2 opacity-30" />
            <p className="text-sm">{emptyText ?? tr("No proposals yet")}</p>
            {!emptyText && (
                <Link href="/proposals/create"
                    className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                    {tr("Submit your first proposal →")}
                </Link>
            )}
        </div>
    )

    return (
        <div className="divide-y divide-gray-50">
            {proposals.slice(0, 6).map(p => (
                <Link key={p.id} href={`/proposals/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">
                            {p.title}
                        </p>
                        <p className="text-[11px] font-mono text-indigo-400 mt-0.5">{p.tracker_number}</p>
                    </div>
                    <span className={cn(
                        'shrink-0 text-xs px-2.5 py-1 rounded-full font-medium',
                        getStatusColor(p.status)
                    )}>
                        {getStatusLabel(p.status)}
                    </span>
                </Link>
            ))}
        </div>
    )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
    const { user, hasPermission, accessScope } = useAuth()

    // Settings come from Inertia shared props — always in sync with the DB
    const appSettings = usePage().props.app_settings ?? {}
    const settings = {
        system_name:           appSettings.system_name           ?? 'RTT Platform',
        organization_name:     appSettings.organization_name     ?? 'University',
        current_academic_year: appSettings.current_academic_year ?? '2026-2027',
        primary_color:         appSettings.primary_color         ?? '#4F46E5',
    }

    const [widgets,  setWidgets]  = useState({})
    const [stats,    setStats]    = useState({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            api.get('/dashboard'),
            api.get('/stats'),
        ]).then(([dRes, sRes]) => {
            setWidgets(dRes.data?.data ?? {})
            setStats(sRes.data?.data ?? {})
        }).catch(() => {}).finally(() => setLoading(false))
    }, [])

    rememberRoleLabels(user?.role_labels)
    const roles           = user?.roles?.map(r => typeof r === 'string' ? r : r.name) ?? []
    // Which dashboard to show follows what the user can do, not their role name.
    const isAdmin         = hasPermission('proposals.validate')
    const isPI            = accessScope.type === 'own' && hasPermission('proposals.submit')
    const isFinance       = !isAdmin && hasPermission('funds.disburse')
    const isCollegeOfficer = accessScope.type === 'college'

    const statusCounts  = widgets.proposals_by_status ?? {}
    const trendData     = widgets.proposal_trend_chart ?? []
    const pendingTasks  = widgets.pending_tasks ?? {}
    const notifications = widgets.recent_notifications ?? []
    const budgetSummary = widgets.budget_utilization_summary ?? {}
    const myProposals   = widgets.my_proposals ?? []
    const collegeProposals = widgets.college_proposals ?? []
    const headline      = widgets.headline ?? {}
    const budgetWidget  = widgets.budget_utilization_summary
    // Reviewing is something people do, not a role: anyone with reviews to do sees them.
    const isReviewer    = (pendingTasks.reviews_pending ?? 0) > 0
    const actions       = quickActions({ isAdmin, isPI, isReviewer, isFinance, isCollegeOfficer })
    const visibleTasks  = Object.entries(pendingTasks).filter(([key]) => TASK_DEFS[key])
    const taskTotal     = visibleTasks.reduce((sum, [, n]) => sum + (n ?? 0), 0)
    const yearLabel     = headline.academic_year ?? settings.current_academic_year

    // ─── Stat cards config ────────────────────────────────────────────────────
    const statCards = isAdmin ? [
        {
            label: 'Submitted', value: headline.submitted,
            subLabel: `AY ${yearLabel}`,
            icon: FileText, colorKey: 'indigo', href: '/proposals',
        },
        {
            label: 'Active Calls', value: headline.active_calls,
            subLabel: 'Open for submissions',
            icon: Megaphone, colorKey: 'emerald', href: '/proposal-calls',
        },
        {
            label: 'In Evaluation', value: headline.under_review,
            subLabel: 'From validation to central evaluation',
            icon: Search, colorKey: 'purple', href: '/proposals',
        },
        {
            label: 'Funded', value: headline.funded,
            subLabel: 'Funded, ongoing or completed',
            icon: Award, colorKey: 'amber', href: '/admin/awarded',
        },
    ] : isPI ? [
        {
            label: 'My Proposals', value: myProposals.length,
            subLabel: 'All time',
            icon: FileText, colorKey: 'indigo', href: '/my-proposals',
        },
        {
            label: 'Draft', value: pendingTasks.drafts_in_progress ?? 0,
            subLabel: 'Not yet submitted',
            icon: FileText, colorKey: 'gray', href: '/my-proposals',
        },
        {
            label: 'Under Review', value: myProposals.filter(p => ['under_blind_review','under_open_defence'].includes(p.status)).length,
            subLabel: 'In evaluation',
            icon: Search, colorKey: 'purple', href: '/my-proposals',
        },
        {
            label: 'Funded', value: myProposals.filter(p => ['funded','midterm_evaluation','completed'].includes(p.status)).length,
            subLabel: 'Active grants',
            icon: Award, colorKey: 'amber', href: '/my-proposals',
        },
    ] : isFinance ? [
        {
            label: 'Disbursements', value: pendingTasks.disbursements_pending ?? 0,
            subLabel: 'Awaiting payment',
            icon: DollarSign, colorKey: 'emerald', href: '/disbursements',
        },
        {
            label: 'Settlements', value: pendingTasks.settlements_to_finalize ?? 0,
            subLabel: 'Pending verification',
            icon: FileText, colorKey: 'teal', href: '/settlements',
        },
    ] : isCollegeOfficer ? [
        {
            label: 'Submitted', value: headline.submitted,
            subLabel: `College · AY ${yearLabel}`,
            icon: Building2, colorKey: 'indigo', href: '/proposals',
        },
        {
            label: 'In Evaluation', value: headline.under_review,
            subLabel: 'Being reviewed now',
            icon: Search, colorKey: 'purple', href: '/proposals',
        },
        {
            label: 'Budget Requests', value: pendingTasks.budget_requests_pending ?? 0,
            subLabel: 'Pending approval',
            icon: DollarSign, colorKey: 'amber', href: '/budget-requests',
        },
        {
            label: 'Funded', value: headline.funded,
            subLabel: 'Funded, ongoing or completed',
            icon: Award, colorKey: 'emerald', href: '/proposals',
        },
    ] : []

    // ─── Banner right-side mini stats ──────────────────────────────────────────
    const bannerStats = loading ? [] : (isAdmin || isCollegeOfficer) ? [
        { label: 'Submitted', value: headline.submitted ?? 0 },
        { label: 'In evaluation', value: headline.under_review ?? 0 },
        { label: 'Funded', value: headline.funded ?? 0 },
    ] : isPI ? [
        { label: 'Total', value: myProposals.length },
        { label: 'Funded', value: myProposals.filter(p => ['funded','midterm_evaluation','completed'].includes(p.status)).length },
        { label: 'Drafts', value: pendingTasks.drafts_in_progress ?? 0 },
    ] : isReviewer ? [
        { label: 'Reviews to do', value: pendingTasks.reviews_pending ?? 0 },
        { label: 'Overdue', value: pendingTasks.reviews_overdue ?? 0 },
    ] : []

    return (
        <AppLayout breadcrumb="Dashboard">
            <div className="max-w-7xl mx-auto space-y-5 pb-6">

                {/* ── Welcome banner ─────────────────────────────────────── */}
                <div className="rounded-2xl overflow-hidden shadow-sm relative"
                    style={{ background: `linear-gradient(135deg, ${settings.primary_color} 0%, #7c3aed 100%)` }}>
                    {/* Decorative circles */}
                    <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/5 pointer-events-none" />
                    <div className="absolute top-6 right-20 h-20 w-20 rounded-full bg-white/5 pointer-events-none" />
                    <div className="absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />

                    <div className="relative p-6">
                        <div className="flex items-start justify-between gap-6 flex-wrap">
                            {/* Left: greeting + badges + actions */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-white/60 text-xs font-medium mb-2 flex-wrap">
                                    <Calendar size={12} />
                                    <span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    <span className="opacity-40">·</span>
                                    <span>{tr("AY :current_academic_year", { current_academic_year: yearLabel })}</span>
                                </div>
                                <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">
                                    {greeting()}, {user?.name?.split(' ')[0] ?? 'User'}! 👋
                                </h1>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white">
                                        <Building2 size={11} />
                                        {settings.organization_name}
                                    </span>
                                    <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white">
                                        {roles[0] ? roleLabel(roles[0]) : 'User'}
                                    </span>
                                    {(headline.active_calls ?? stats.active_calls) > 0 && (
                                        <span className="bg-green-400/30 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white">
                                            {headline.active_calls ?? stats.active_calls} active call{(headline.active_calls ?? stats.active_calls) !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                                <QuickActionsBanner isAdmin={isAdmin} isPI={isPI} isReviewer={isReviewer} isFinance={isFinance} />
                            </div>

                            {/* Right: mini KPI strip (desktop only) */}
                            {bannerStats.length > 0 && (
                                <div className="hidden lg:flex items-center gap-6 shrink-0 self-center">
                                    {bannerStats.map((s, i) => (
                                        <div key={s.label} className={cn(
                                            'text-center px-4',
                                            i > 0 && 'border-l border-white/20'
                                        )}>
                                            <div className="text-3xl font-bold text-white leading-none">{s.value}</div>
                                            <div className="text-xs text-white/50 mt-1 uppercase tracking-wide">{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Stat cards ─────────────────────────────────────────── */}
                {statCards.length > 0 && (
                    <div className={cn('grid gap-4', {
                        'grid-cols-2 lg:grid-cols-4': statCards.length === 4,
                        'grid-cols-2 sm:grid-cols-3': statCards.length === 3,
                        'grid-cols-2':               statCards.length === 2,
                    })}>
                        {statCards.map(card => (
                            <StatCard key={card.label} {...card} loading={loading} />
                        ))}
                    </div>
                )}

                {/* ── Quick Actions card ──────────────────────────────────── */}
                {actions.length > 0 && (
                    <SectionCard title={tr("Quick Actions")}>
                        <QuickActions actions={actions} />
                    </SectionCard>
                )}

                {/* ── Main 2-column layout ────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* ── LEFT COLUMN (2/3) ─────────────────────────────── */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* Trend chart (admin / central_officer) */}
                        {(loading ? isAdmin : widgets.proposal_trend_chart) && (
                            <SectionCard
                                title={tr("Proposal Submissions")}
                                action={<span className="text-xs text-gray-400 font-medium">{tr("Last 6 months")}</span>}
                            >
                                <TrendChart data={trendData} loading={loading} />
                            </SectionCard>
                        )}

                        {/* My Proposals list (PI / staff) */}
                        {isPI && (
                            <SectionCard
                                title={tr("My Proposals")}
                                action={
                                    <Link href="/my-proposals"
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                        {tr("View all")} <ChevronRight size={11} />
                                    </Link>
                                }
                            >
                                <MyProposalsList proposals={myProposals} loading={loading} />
                            </SectionCard>
                        )}

                        {/* College proposals summary (college_officer) */}
                        {isCollegeOfficer && !isAdmin && (
                            <SectionCard
                                title={tr("College Proposals")}
                                action={
                                    <Link href="/proposals"
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                        {tr("View all")} <ChevronRight size={11} />
                                    </Link>
                                }
                            >
                                <MyProposalsList proposals={collegeProposals} loading={loading} emptyText={tr("No proposals from your college yet")} />
                            </SectionCard>
                        )}

                        {/* Pending tasks */}
                        <SectionCard
                            title={tr("Action Center")}
                            action={
                                <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                    <Clock size={11} />
                                    {taskTotal} {taskTotal === 1 ? 'item' : 'items'}
                                </span>
                            }
                        >
                            <PendingTasks tasks={pendingTasks} loading={loading} />
                        </SectionCard>
                    </div>

                    {/* ── RIGHT COLUMN (1/3) ─────────────────────────────── */}
                    <div className="space-y-5">

                        {/* Pipeline distribution */}
                        <SectionCard title={tr("Proposal Pipeline")}>
                            <PipelineDonut statusCounts={statusCounts} loading={loading} />
                        </SectionCard>

                        {/* Budget summary (admin / finance) */}
                        {(loading ? (isAdmin || isFinance) : budgetWidget) && (
                            <SectionCard
                                title={tr("Budget Summary")}
                                action={
                                    <span className="text-xs text-gray-400 font-medium">
                                        {tr("AY :current_academic_year", { current_academic_year: budgetSummary.fiscal_year ?? yearLabel })}
                                    </span>
                                }
                            >
                                <BudgetSummary data={budgetSummary} loading={loading} />
                            </SectionCard>
                        )}

                        {/* Notifications */}
                        <SectionCard
                            title={tr("Notifications")}
                            action={
                                <Link href="/notifications"
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                    {tr("View all")} <ChevronRight size={11} />
                                </Link>
                            }
                        >
                            <NotificationsPanel notifications={notifications} loading={loading} />
                        </SectionCard>

                        {/* System info (super_admin only) */}
                        {hasPermission('system_monitor.manage') && (
                            <SectionCard>
                                <div className="px-5 py-4 space-y-3">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        {settings.system_name}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'Proposals', value: stats.total_proposals ?? 0, color: 'text-indigo-600' },
                                            { label: 'Colleges',  value: stats.colleges ?? 0,        color: 'text-emerald-600' },
                                            { label: 'Funded',    value: stats.funded ?? 0,           color: 'text-amber-600' },
                                        ].map(item => (
                                            <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                                                <p className={cn('text-xl font-bold leading-none', item.color)}>{item.value}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{item.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </SectionCard>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
