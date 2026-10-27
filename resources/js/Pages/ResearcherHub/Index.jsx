import { useState, useEffect } from 'react'
import { translate as tr } from '../../lib/i18n'
import { Link } from '@inertiajs/react'
import {
    FileText, ClipboardCheck, BookOpen, DollarSign,
    Calendar, Clock, ChevronRight, ArrowUpRight, ArrowDownRight,
    FlaskConical, Lightbulb, Users, Globe, Award,
    AlertCircle, CheckCircle2, BarChart2, Download, Sparkles,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import api from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, cn } from '../../lib/utils'
import { currency } from '../../lib/terms'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CARD_COLORS = {
    indigo:  { border: 'border-l-4 border-l-indigo-500',  iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600'  },
    emerald: { border: 'border-l-4 border-l-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    purple:  { border: 'border-l-4 border-l-purple-500',  iconBg: 'bg-purple-50',  iconColor: 'text-purple-600'  },
    amber:   { border: 'border-l-4 border-l-amber-500',   iconBg: 'bg-amber-50',   iconColor: 'text-amber-600'   },
    blue:    { border: 'border-l-4 border-l-blue-500',    iconBg: 'bg-blue-50',    iconColor: 'text-blue-600'    },
    teal:    { border: 'border-l-4 border-l-teal-500',    iconBg: 'bg-teal-50',    iconColor: 'text-teal-600'    },
}

function daysUntil(dateStr) {
    if (!dateStr) return null
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
    return diff
}

function urgencyClass(days) {
    if (days == null) return 'text-gray-400'
    if (days <= 0) return 'text-red-600 font-semibold'
    if (days <= 3) return 'text-red-500 font-medium'
    if (days <= 7) return 'text-amber-600 font-medium'
    return 'text-gray-500'
}

function urgencyLabel(days) {
    if (days == null) return ''
    if (days <= 0) return 'Overdue'
    if (days === 1) return '1 day left'
    return `${days} days left`
}

const OUTPUT_TYPE_META = {
    journal_article:      { label: 'Journal Articles',  icon: BookOpen,   color: 'text-blue-500',   bg: 'bg-blue-50'    },
    conference_paper:     { label: 'Conference Papers', icon: Users,      color: 'text-emerald-500',bg: 'bg-emerald-50' },
    book:                 { label: 'Books',             icon: BookOpen,   color: 'text-indigo-500', bg: 'bg-indigo-50'  },
    patent:               { label: 'Patents',           icon: Award,      color: 'text-purple-500', bg: 'bg-purple-50'  },
    software:             { label: 'Software',          icon: Lightbulb,  color: 'text-amber-500',  bg: 'bg-amber-50'   },
    prototype:            { label: 'Prototypes',        icon: FlaskConical,color: 'text-orange-500',bg: 'bg-orange-50'  },
    community_impact:     { label: 'Community Impact',  icon: Globe,      color: 'text-teal-500',   bg: 'bg-teal-50'    },
    technology_transfer:  { label: 'Technology',        icon: BarChart2,  color: 'text-rose-500',   bg: 'bg-rose-50'    },
}

function Skeleton({ className = '' }) {
    return <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`} />
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, subLabel, icon: Icon, colorKey, href, loading }) {
    const Tag = href ? Link : 'div'
    const colors = CARD_COLORS[colorKey] ?? CARD_COLORS.indigo
    return (
        <Tag href={href}
            className={cn(
                'bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2.5',
                'hover:shadow-md transition-all duration-200',
                href && 'group cursor-pointer',
                colors.border,
            )}>
            <div className="flex items-start justify-between">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', colors.iconBg)}>
                    <Icon size={16} className={colors.iconColor} />
                </div>
                {href && (
                    <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                )}
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

// ─── Funding opportunities matched to the researcher ──────────────────────────

/** Open opportunities that match the researcher's expertise and past proposals; hidden when there are none. */
function RecommendedOpportunities() {
    const [items, setItems] = useState(null)

    useEffect(() => {
        api.get('/external-funds/opportunities/recommended')
            .then(r => setItems(r.data?.data ?? []))
            .catch(() => setItems([]))
    }, [])

    if (!items || items.length === 0) return null

    return (
        <div className="mt-6">
            <SectionCard
                title={tr("Funding for you")}
                action={
                    <Link href="/funding-opportunities" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                        {tr("All opportunities")} <ChevronRight size={12} />
                    </Link>
                }
            >
                <ul className="divide-y divide-gray-50">
                    {items.map(o => {
                        const days = o.deadline ? daysUntil(o.deadline) : null
                        return (
                            <li key={o.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-900">{o.title}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">
                                        {[o.agency, o.amount_max ? `${tr('up to')} ${o.currency ?? ''} ${Number(o.amount_max).toLocaleString()}` : null].filter(Boolean).join(' · ')}
                                    </p>
                                    {o.reasons?.length > 0 && (
                                        <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-emerald-700">
                                            <Sparkles size={11} /> {tr('Matches')}: {o.reasons.join(', ')}
                                        </p>
                                    )}
                                </div>
                                {days !== null && (
                                    <span className={cn('shrink-0 self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:self-center', urgencyClass(days))}>
                                        {urgencyLabel(days)}
                                    </span>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </SectionCard>
        </div>
    )
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }) {
    const map = {
        research:             'bg-blue-50 text-blue-700',
        community_engagement: 'bg-green-50 text-green-700',
        technology_transfer:  'bg-purple-50 text-purple-700',
        innovation:           'bg-orange-50 text-orange-700',
        other:                'bg-gray-50 text-gray-600',
        proposal_call:        'bg-indigo-50 text-indigo-700',
        external_fund:        'bg-teal-50 text-teal-700',
    }
    const labels = {
        research: 'Research', community_engagement: 'Community',
        technology_transfer: 'Technology', innovation: 'Innovation',
        proposal_call: 'Call', external_fund: 'External Fund', other: 'Other',
    }
    return (
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', map[category] ?? 'bg-gray-50 text-gray-600')}>
            {labels[category] ?? category}
        </span>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResearcherHubIndex() {
    const { user } = useAuth()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get('/researcher-hub')
            .then(res => setData(res.data.data))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const proposals          = data?.proposals ?? []
    const reviewAssignments  = data?.reviewAssignments ?? []
    const upcomingDeadlines  = data?.upcomingDeadlines ?? []
    const researchOutputs    = data?.researchOutputs ?? {}
    const budgetSummary      = data?.budgetSummary ?? {}

    const activeProposals    = proposals.filter(p => !['completed', 'archived', 'rejected'].includes(p.status))
    const totalOutputs       = Object.values(researchOutputs).reduce((a, b) => a + b, 0)

    const calendarUrl = `/api/v1/calendar/export?token=${localStorage.getItem('rtt_token') ?? ''}`

    return (
        <AppLayout breadcrumb="My Research Hub">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">{tr("My Research Hub")}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Your research at a glance'}
                    </p>
                </div>
                <a
                    href={calendarUrl}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <Download size={12} />
                    {tr("Export Calendar")}
                </a>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    label="Active Proposals"
                    value={loading ? null : activeProposals.length}
                    subLabel={`${proposals.length} total`}
                    icon={FileText}
                    colorKey="indigo"
                    href="/my-proposals"
                    loading={loading}
                />
                <StatCard
                    label="Pending Reviews"
                    value={loading ? null : reviewAssignments.length}
                    subLabel="awaiting submission"
                    icon={ClipboardCheck}
                    colorKey="amber"
                    href="/reviews"
                    loading={loading}
                />
                <StatCard
                    label="Research Outputs"
                    value={loading ? null : totalOutputs}
                    subLabel="publications, patents & more"
                    icon={BookOpen}
                    colorKey="teal"
                    href="/research-outputs"
                    loading={loading}
                />
                <StatCard
                    label="Total Awarded"
                    value={loading ? null : (budgetSummary.awarded ? formatCurrency(budgetSummary.awarded) : formatCurrency(0))}
                    subLabel={budgetSummary.disbursed ? `${currency()} ${budgetSummary.disbursed} disbursed` : 'no disbursements yet'}
                    icon={DollarSign}
                    colorKey="emerald"
                    loading={loading}
                />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* My Proposals — spans 2 cols */}
                <SectionCard
                    className="lg:col-span-2"
                    title={tr("My Proposals")}
                    action={
                        <Link href="/my-proposals" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            {tr("View all")} <ChevronRight size={12} />
                        </Link>
                    }
                >
                    {loading ? (
                        <div className="divide-y divide-gray-50">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="px-5 py-3 flex items-center gap-3">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 flex-1" />
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : proposals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <FileText size={32} className="mb-2 opacity-30" />
                            <p className="text-sm">{tr("No proposals yet")}</p>
                            <Link href="/proposals/create" className="mt-3 text-xs text-indigo-600 hover:underline">
                                {tr("Submit your first proposal →")}
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {proposals.slice(0, 8).map(p => (
                                <Link
                                    key={p.id}
                                    href={`/proposals/${p.id}`}
                                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
                                >
                                    <span className="text-xs font-mono text-gray-400 shrink-0 w-20 truncate">{p.tracker_number}</span>
                                    <span className="text-sm text-gray-700 flex-1 truncate group-hover:text-gray-900">{p.title}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {p.role === 'co_investigator' && (
                                            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{tr("Co-PI")}</span>
                                        )}
                                        {p.award?.awarded_amount && (
                                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                {formatCurrency(p.award.awarded_amount)}
                                            </span>
                                        )}
                                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', getStatusColor(p.status))}>
                                            {getStatusLabel(p.status)}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                            {proposals.length > 8 && (
                                <div className="px-5 py-3 text-center">
                                    <Link href="/my-proposals" className="text-xs text-indigo-600 hover:underline">
                                        {tr("+:proposals_count more proposals", { proposals_count: proposals.length - 8 })}
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </SectionCard>

                {/* Right column */}
                <div className="flex flex-col gap-6">

                    {/* Pending Reviews */}
                    <SectionCard
                        title={tr("Pending Reviews")}
                        action={
                            reviewAssignments.length > 0 && (
                                <Link href="/reviews" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                    {tr("View all")} <ChevronRight size={12} />
                                </Link>
                            )
                        }
                    >
                        {loading ? (
                            <div className="divide-y divide-gray-50">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="px-5 py-3 space-y-1.5">
                                        <Skeleton className="h-3.5 w-full" />
                                        <Skeleton className="h-3 w-2/3" />
                                    </div>
                                ))}
                            </div>
                        ) : reviewAssignments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                <CheckCircle2 size={24} className="mb-2 opacity-30" />
                                <p className="text-xs">{tr("No pending reviews")}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {reviewAssignments.slice(0, 5).map(r => {
                                    const days = daysUntil(r.due_date)
                                    return (
                                        <Link
                                            key={r.id}
                                            href={`/reviews/${r.id}/score`}
                                            className="flex flex-col px-5 py-3 hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="text-sm text-gray-800 font-medium truncate">
                                                {r.proposal?.tracker_number}
                                            </span>
                                            <span className="text-xs text-gray-500 truncate mt-0.5">{r.proposal?.title}</span>
                                            <div className="flex items-center justify-between mt-1.5">
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                                    {r.evaluation_type?.label ?? r.evaluation_type?.name ?? 'Review'}
                                                </span>
                                                <span className={cn('text-[10px]', urgencyClass(days))}>
                                                    <Clock size={9} className="inline mr-0.5" />
                                                    {r.due_date ? urgencyLabel(days) : 'No deadline'}
                                                </span>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </SectionCard>

                    {/* Upcoming Deadlines */}
                    <SectionCard
                        title={tr("Upcoming Deadlines")}
                        action={
                            <a
                                href={calendarUrl}
                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                                <Download size={10} /> {tr(".ics")}
                            </a>
                        }
                    >
                        {loading ? (
                            <div className="divide-y divide-gray-50">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                                        <Skeleton className="h-3.5 flex-1" />
                                        <Skeleton className="h-3 w-12" />
                                    </div>
                                ))}
                            </div>
                        ) : upcomingDeadlines.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                <Calendar size={24} className="mb-2 opacity-30" />
                                <p className="text-xs">{tr("No upcoming deadlines")}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {upcomingDeadlines.map(d => {
                                    const days = daysUntil(d.date)
                                    return (
                                        <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-800 truncate">{d.title}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <CategoryBadge category={d.type} />
                                                    <span className="text-[10px] text-gray-400">{formatDate(d.date)}</span>
                                                </div>
                                            </div>
                                            <span className={cn('text-[10px] shrink-0', urgencyClass(days))}>
                                                {urgencyLabel(days)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </SectionCard>

                </div>
            </div>

            {/* Research Outputs row */}
            <div className="mt-6">
                <SectionCard
                    title={tr("Research Outputs")}
                    action={
                        <Link href="/research-outputs" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            {tr("Manage")} <ChevronRight size={12} />
                        </Link>
                    }
                >
                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-5">
                            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-gray-50">
                            {Object.entries(OUTPUT_TYPE_META).map(([type, meta]) => {
                                const count = researchOutputs[type] ?? 0
                                const Icon = meta.icon
                                return (
                                    <div key={type} className="flex flex-col items-center justify-center py-6 gap-2">
                                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', meta.bg)}>
                                            <Icon size={16} className={meta.color} />
                                        </div>
                                        <span className="text-2xl font-bold text-gray-900">{count}</span>
                                        <span className="text-[10px] text-gray-500 text-center leading-tight">{meta.label}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </SectionCard>
            </div>

            <RecommendedOpportunities />
        </AppLayout>
    )
}
