import { useState, useEffect } from 'react'
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

const PIPELINE_COLORS = [
    '#6366f1','#3b82f6','#f59e0b','#f97316',
    '#10b981','#059669','#0d9488','#ef4444','#64748b',
]

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

function TrendChart({ data, loading, primaryColor }) {
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
            <p className="text-sm">No submission data yet</p>
        </div>
    )

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
                    <Bar dataKey="research"             name="Research"   fill={primaryColor ?? '#6366f1'} radius={[4,4,0,0]} />
                    <Bar dataKey="community_engagement" name="Community"  fill="#10b981"                  radius={[4,4,0,0]} />
                    <Bar dataKey="technology_transfer"  name="Technology" fill="#f59e0b"                  radius={[4,4,0,0]} />
                </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-1">
                {[
                    { label: 'Research',   color: primaryColor ?? '#6366f1' },
                    { label: 'Community',  color: '#10b981' },
                    { label: 'Technology', color: '#f59e0b' },
                ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
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
        .map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v }))

    const total = entries.reduce((s, e) => s + e.value, 0)

    if (loading) return (
        <div className="flex justify-center py-6">
            <Skeleton className="h-36 w-36 rounded-full" />
        </div>
    )

    if (!total) return (
        <div className="py-8 text-center text-gray-400 text-sm">No proposals yet</div>
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
                                {entries.map((_, i) => (
                                    <Cell key={i} fill={PIPELINE_COLORS[i % PIPELINE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 11, border: '1px solid #e5e7eb' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-gray-800 leading-none">{total}</span>
                        <span className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">Total</span>
                    </div>
                </div>
            </div>
            {/* Legend */}
            <div className="space-y-1.5">
                {entries.map((e, i) => (
                    <div key={e.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: PIPELINE_COLORS[i % PIPELINE_COLORS.length] }} />
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
    const disbursed = parseFloat(data?.total_disbursed ?? 0)
    const settled   = parseFloat(data?.total_settled   ?? 0)
    const pct       = allocated > 0 ? Math.min(100, Math.round((disbursed / allocated) * 100)) : 0

    const rows = [
        { label: 'Allocated', value: allocated, color: 'bg-indigo-500', pct: 100 },
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
                    <span className="text-xs text-gray-400">Disbursement rate</span>
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
            <p className="text-sm font-medium text-gray-500">All caught up!</p>
            <p className="text-xs text-gray-400 mt-0.5">No pending actions</p>
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
            <p className="text-sm">No new notifications</p>
        </div>
    )

    return (
        <div className="divide-y divide-gray-50">
            {notifications.slice(0, 6).map(n => (
                <div key={n.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors">
                    <div className="h-2 w-2 rounded-full bg-indigo-400 shrink-0 mt-2" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 capitalize leading-snug">
                            {n.data?.message ?? n.type?.replace(/_/g, ' ')}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                            {n.data?.tracker_number && (
                                <span className="text-[10px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    {n.data.tracker_number}
                                </span>
                            )}
                            <span className="text-[10px] text-gray-400">{timeAgo(n.created_at)}</span>
                        </div>
                    </div>
                </div>
            ))}
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
function QuickActions({ isAdmin, isPI, isReviewer, isFinance, isCollegeOfficer }) {
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
    ] : isReviewer ? [
        { label: 'My Reviews',      href: '/reviews',          icon: ClipboardCheck },
        { label: 'My Proposals',    href: '/my-proposals',     icon: FileText },
    ] : isFinance ? [
        { label: 'Disbursements',   href: '/disbursements',    icon: DollarSign },
        { label: 'Settlements',     href: '/settlements',      icon: FileText },
    ] : isCollegeOfficer ? [
        { label: 'College Proposals', href: '/proposals',        icon: Building2 },
        { label: 'Budget Requests',   href: '/budget-requests',  icon: DollarSign },
    ] : []

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

function MyProposalsList({ proposals, loading }) {
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
            <p className="text-sm">No proposals yet</p>
            <Link href="/proposals/create"
                className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                Submit your first proposal →
            </Link>
        </div>
    )

    return (
        <div className="divide-y divide-gray-50">
            {proposals.slice(0, 6).map(p => (
                <div key={p.id}
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
                </div>
            ))}
        </div>
    )
}

// ─── Reviewer queue (enhanced) ────────────────────────────────────────────────

function ReviewQueue({ queue, loading }) {
    if (loading) return (
        <div className="divide-y divide-gray-50">
            {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-32" />
                    </div>
                    <Skeleton className="h-7 w-14 rounded-xl" />
                </div>
            ))}
        </div>
    )

    if (!queue?.length) return (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <CheckCircle2 size={28} className="mb-2 opacity-30 text-green-400" />
            <p className="text-sm">No reviews assigned</p>
        </div>
    )

    return (
        <div className="divide-y divide-gray-50">
            {queue.slice(0, 6).map(a => {
                const overdue = a.days_remaining != null && a.days_remaining < 0
                const urgent  = a.days_remaining != null && a.days_remaining >= 0 && a.days_remaining <= 3
                return (
                    <div key={a.assignment_id}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] font-mono text-indigo-400">{a.tracker_number}</span>
                                {a.days_remaining != null && (
                                    <span className={cn(
                                        'text-[10px] px-1.5 py-0.5 rounded font-semibold',
                                        overdue ? 'bg-red-50 text-red-600'
                                        : urgent ? 'bg-amber-50 text-amber-700'
                                        : 'bg-gray-50 text-gray-500'
                                    )}>
                                        {overdue
                                            ? `${Math.abs(a.days_remaining)}d overdue`
                                            : `${a.days_remaining}d left`
                                        }
                                    </span>
                                )}
                            </div>
                        </div>
                        <Link href={`/reviews/${a.assignment_id}/score`}
                            className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold
                                       rounded-xl hover:bg-indigo-700 transition-colors">
                            Score
                        </Link>
                    </div>
                )
            })}
        </div>
    )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
    const { user, hasRole, hasAnyRole } = useAuth()

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

    const roles           = user?.roles?.map(r => typeof r === 'string' ? r : r.name) ?? []
    const isAdmin         = hasAnyRole(['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'])
    const isPI            = hasRole('staff')
    const isReviewer      = false
    const isFinance       = hasRole('finance_officer')
    const isCollegeOfficer = hasRole('college_officer')

    const statusCounts  = widgets.proposals_by_status ?? {}
    const trendData     = widgets.proposal_trend_chart ?? []
    const pendingTasks  = widgets.pending_tasks ?? {}
    const notifications = widgets.recent_notifications ?? []
    const budgetSummary = widgets.budget_utilization_summary ?? {}
    const myProposals   = widgets.my_proposals ?? []
    const reviewerQueue = widgets.reviewer_queue ?? []

    const totalUnderReview = (statusCounts.under_blind_review ?? 0) + (statusCounts.under_open_defence ?? 0)

    // ─── Stat cards config ────────────────────────────────────────────────────
    const statCards = isAdmin ? [
        {
            label: 'Total Proposals', value: stats.total_proposals,
            subLabel: `AY ${settings.current_academic_year}`,
            icon: FileText, colorKey: 'indigo', href: '/proposals',
        },
        {
            label: 'Active Calls', value: stats.active_calls,
            subLabel: 'Open for submissions',
            icon: Megaphone, colorKey: 'emerald', href: '/proposal-calls',
        },
        {
            label: 'Under Review', value: totalUnderReview,
            subLabel: 'Blind review + open defence',
            icon: Search, colorKey: 'purple', href: '/admin/blind-review',
        },
        {
            label: 'Funded', value: stats.funded,
            subLabel: `${stats.colleges ?? 0} colleges`,
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
    ] : isReviewer ? [
        {
            label: 'Assigned', value: reviewerQueue.length,
            subLabel: 'Total reviews',
            icon: ClipboardCheck, colorKey: 'blue', href: '/reviews',
        },
        {
            label: 'Pending', value: pendingTasks.reviews_pending ?? 0,
            subLabel: 'Not yet scored',
            icon: FileText, colorKey: 'amber', href: '/reviews',
        },
        {
            label: 'Overdue', value: pendingTasks.reviews_overdue ?? 0,
            subLabel: 'Past due date',
            icon: AlertCircle, colorKey: 'red', href: '/reviews',
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
            label: 'College Proposals', value: myProposals.length,
            subLabel: 'All time',
            icon: Building2, colorKey: 'indigo', href: '/proposals',
        },
        {
            label: 'Under Review', value: myProposals.filter(p => ['under_blind_review','under_open_defence'].includes(p.status)).length,
            subLabel: 'In evaluation',
            icon: Search, colorKey: 'purple', href: '/proposals',
        },
        {
            label: 'Budget Requests', value: pendingTasks.budget_requests_pending ?? 0,
            subLabel: 'Pending approval',
            icon: DollarSign, colorKey: 'amber', href: '/budget-requests',
        },
        {
            label: 'Funded', value: myProposals.filter(p => ['funded','midterm_evaluation','completed'].includes(p.status)).length,
            subLabel: 'Active grants',
            icon: Award, colorKey: 'emerald', href: '/proposals',
        },
    ] : []

    // ─── Banner right-side mini stats ──────────────────────────────────────────
    const bannerStats = isAdmin && !loading ? [
        { label: 'Proposals', value: stats.total_proposals ?? 0 },
        { label: 'Funded',    value: stats.funded ?? 0 },
        { label: 'Colleges',  value: stats.colleges ?? 0 },
    ] : isPI && !loading ? [
        { label: 'Total', value: myProposals.length },
        { label: 'Funded', value: myProposals.filter(p => ['funded','midterm_evaluation','completed'].includes(p.status)).length },
        { label: 'Drafts', value: pendingTasks.drafts_in_progress ?? 0 },
    ] : isReviewer && !loading ? [
        { label: 'Assigned', value: reviewerQueue.length },
        { label: 'Pending',  value: pendingTasks.reviews_pending ?? 0 },
        { label: 'Overdue',  value: pendingTasks.reviews_overdue ?? 0 },
    ] : isCollegeOfficer && !loading ? [
        { label: 'Proposals', value: myProposals.length },
        { label: 'Funded',    value: myProposals.filter(p => ['funded','midterm_evaluation','completed'].includes(p.status)).length },
        { label: 'Requests',  value: pendingTasks.budget_requests_pending ?? 0 },
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
                                    <span>AY {settings.current_academic_year}</span>
                                </div>
                                <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">
                                    {greeting()}, {user?.name?.split(' ')[0] ?? 'User'}! 👋
                                </h1>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white">
                                        <Building2 size={11} />
                                        {settings.organization_name}
                                    </span>
                                    <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white capitalize">
                                        {roles[0]?.replace(/_/g, ' ') ?? 'User'}
                                    </span>
                                    {stats.active_calls > 0 && (
                                        <span className="bg-green-400/30 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white">
                                            {stats.active_calls} active call{stats.active_calls !== 1 ? 's' : ''}
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
                <SectionCard title="Quick Actions">
                    <QuickActions isAdmin={isAdmin} isPI={isPI} isReviewer={isReviewer} isFinance={isFinance} isCollegeOfficer={isCollegeOfficer} />
                </SectionCard>

                {/* ── Main 2-column layout ────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* ── LEFT COLUMN (2/3) ─────────────────────────────── */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* Trend chart (admin / central_officer) */}
                        {isAdmin && (
                            <SectionCard
                                title="Proposal Submissions"
                                action={<span className="text-xs text-gray-400 font-medium">Last 6 months</span>}
                            >
                                <TrendChart data={trendData} loading={loading} primaryColor={settings.primary_color} />
                            </SectionCard>
                        )}

                        {/* My Proposals list (PI / staff) */}
                        {isPI && (
                            <SectionCard
                                title="My Proposals"
                                action={
                                    <Link href="/my-proposals"
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                        View all <ChevronRight size={11} />
                                    </Link>
                                }
                            >
                                <MyProposalsList proposals={myProposals} loading={loading} />
                            </SectionCard>
                        )}

                        {/* College proposals summary (college_officer) */}
                        {isCollegeOfficer && !isAdmin && (
                            <SectionCard
                                title="College Proposals"
                                action={
                                    <Link href="/proposals"
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                        View all <ChevronRight size={11} />
                                    </Link>
                                }
                            >
                                <MyProposalsList proposals={myProposals} loading={loading} />
                            </SectionCard>
                        )}

                        {/* Review queue (reviewer) */}
                        {isReviewer && (
                            <SectionCard
                                title="Review Queue"
                                action={
                                    <Link href="/reviews"
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                        View all <ChevronRight size={11} />
                                    </Link>
                                }
                            >
                                <ReviewQueue queue={reviewerQueue} loading={loading} />
                            </SectionCard>
                        )}

                        {/* Budget utilization (finance) */}
                        {isFinance && !isAdmin && (
                            <SectionCard
                                title="Budget Utilization"
                                action={
                                    <span className="text-xs text-gray-400 font-medium">
                                        FY {budgetSummary.fiscal_year ?? settings.current_academic_year}
                                    </span>
                                }
                            >
                                <BudgetSummary data={budgetSummary} loading={loading} />
                            </SectionCard>
                        )}

                        {/* Pending tasks */}
                        <SectionCard
                            title="Action Center"
                            action={
                                <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                    <Clock size={11} />
                                    {Object.values(pendingTasks).reduce((s, v) => s + (v ?? 0), 0)} items
                                </span>
                            }
                        >
                            <PendingTasks tasks={pendingTasks} loading={loading} />
                        </SectionCard>
                    </div>

                    {/* ── RIGHT COLUMN (1/3) ─────────────────────────────── */}
                    <div className="space-y-5">

                        {/* Pipeline distribution */}
                        <SectionCard title="Proposal Pipeline">
                            <PipelineDonut statusCounts={statusCounts} loading={loading} />
                        </SectionCard>

                        {/* Budget summary (admin / finance) */}
                        {(isAdmin || isFinance) && (
                            <SectionCard
                                title="Budget Summary"
                                action={
                                    <span className="text-xs text-gray-400 font-medium">
                                        FY {budgetSummary.fiscal_year ?? settings.current_academic_year}
                                    </span>
                                }
                            >
                                <BudgetSummary data={budgetSummary} loading={loading} />
                            </SectionCard>
                        )}

                        {/* Notifications */}
                        <SectionCard
                            title="Notifications"
                            action={
                                <Link href="/notifications"
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                                    View all <ChevronRight size={11} />
                                </Link>
                            }
                        >
                            <NotificationsPanel notifications={notifications} loading={loading} />
                        </SectionCard>

                        {/* System info (super_admin only) */}
                        {hasRole('super_admin') && (
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
