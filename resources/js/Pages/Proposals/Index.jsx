import { useState, useEffect, useMemo } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import ViewToggle from '../../Components/ViewToggle'
import { useViewPreference } from '../../hooks/useViewPreference'
import { useAuth } from '../../hooks/useAuth'
import {
    FolderKanban, Download, FileText, ArrowRight, ChevronLeft, ChevronRight, ChevronDown, Search, X,
    Files, Hourglass, Trophy, XCircle, PencilLine, Building2, BookOpen, Users, Activity, Tags,
    FlaskConical, Handshake, Rocket, Lightbulb, Folder, User, UserRound, Inbox, Loader2, SlidersHorizontal,
} from 'lucide-react'
import api from '../../lib/api'
import { getStatusLabel, getCategoryLabel } from '../../lib/utils'

// ── Look-ups ──────────────────────────────────────────────────────────────────

/** Status groups behind the headline cards — the same statuses the statistics count. */
const UNDER_REVIEW = 'under_blind_review,under_open_defence,accepted'
const FUNDED_GROUP = 'funded,midterm_evaluation,completed,archived'

const STATUS_STYLES = {
    draft:               { dot: 'bg-gray-400',    pill: 'bg-gray-100 text-gray-600 ring-gray-200',          bar: 'bg-gray-400' },
    submitted:           { dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 ring-blue-200',           bar: 'bg-blue-500' },
    validated:           { dot: 'bg-indigo-500',  pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200',     bar: 'bg-indigo-500' },
    under_blind_review:  { dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 ring-amber-200',        bar: 'bg-amber-500' },
    blind_review_passed: { dot: 'bg-orange-500',  pill: 'bg-orange-50 text-orange-700 ring-orange-200',     bar: 'bg-orange-500' },
    under_open_defence:  { dot: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700 ring-violet-200',     bar: 'bg-violet-500' },
    accepted:            { dot: 'bg-teal-500',    pill: 'bg-teal-50 text-teal-700 ring-teal-200',           bar: 'bg-teal-500' },
    funded:              { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',  bar: 'bg-emerald-500' },
    midterm_evaluation:  { dot: 'bg-cyan-500',    pill: 'bg-cyan-50 text-cyan-700 ring-cyan-200',           bar: 'bg-cyan-500' },
    completed:           { dot: 'bg-sky-600',     pill: 'bg-sky-50 text-sky-700 ring-sky-200',              bar: 'bg-sky-600' },
    rejected:            { dot: 'bg-red-500',     pill: 'bg-red-50 text-red-700 ring-red-200',              bar: 'bg-red-500' },
    archived:            { dot: 'bg-slate-500',   pill: 'bg-slate-100 text-slate-600 ring-slate-200',       bar: 'bg-slate-500' },
}
const statusStyle = (s) => STATUS_STYLES[s] ?? STATUS_STYLES.draft

const CATEGORY_STYLES = {
    research:             { icon: FlaskConical, chip: 'bg-blue-50 text-blue-700',     tile: 'bg-blue-100 text-blue-600' },
    community_engagement: { icon: Handshake,    chip: 'bg-emerald-50 text-emerald-700', tile: 'bg-emerald-100 text-emerald-600' },
    technology_transfer:  { icon: Rocket,       chip: 'bg-violet-50 text-violet-700', tile: 'bg-violet-100 text-violet-600' },
    innovation:           { icon: Lightbulb,    chip: 'bg-orange-50 text-orange-700', tile: 'bg-orange-100 text-orange-600' },
    other:                { icon: Folder,       chip: 'bg-gray-100 text-gray-700',    tile: 'bg-gray-100 text-gray-600' },
}
const categoryStyle = (c) => CATEGORY_STYLES[c] ?? CATEGORY_STYLES.other

const STATUS_OPTIONS = [
    ['draft', 'Draft'], ['submitted', 'Submitted'], ['validated', 'Validated'], ['under_blind_review', 'Blind Review'],
    ['blind_review_passed', 'Blind Review Passed'], ['under_open_defence', 'Open Defence'], ['accepted', 'Central Evaluation'],
    ['funded', 'Funded'], ['midterm_evaluation', 'Midterm Evaluation'], ['completed', 'Completed'], ['rejected', 'Rejected'],
]

const KANBAN_COLUMNS = ['submitted', 'validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence', 'accepted', 'funded', 'completed', 'rejected']

const STAT_TABS = [
    { key: 'college',    label: 'Colleges',    icon: Building2 },
    { key: 'department', label: 'Departments', icon: BookOpen },
    { key: 'gender',     label: 'Gender',      icon: Users },
    { key: 'status',     label: 'Status',      icon: Activity },
    { key: 'category',   label: 'Category',    icon: Tags },
]

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

// ── Small pieces ──────────────────────────────────────────────────────────────

function StatusPill({ status }) {
    const s = statusStyle(status)
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${s.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {getStatusLabel(status)}
        </span>
    )
}

function CategoryChip({ category }) {
    const c = categoryStyle(category)
    const Icon = c.icon
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ${c.chip}`}>
            <Icon size={11} /> {getCategoryLabel(category)}
        </span>
    )
}

function PiAvatar({ name }) {
    return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-slate-100 to-slate-200 text-[10px] font-bold text-slate-600 ring-1 ring-white">
            {initials(name)}
        </span>
    )
}

function Kpi({ icon: Icon, label, value, tone, loading, active, onClick, hint }) {
    return (
        <button onClick={onClick}
            className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon size={15} /></span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{loading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-gray-100 align-middle" /> : value}</p>
            <p className="mt-0.5 min-h-4 text-[11px] text-gray-400">{hint}</p>
        </button>
    )
}

function Bar({ pct, className = 'bg-indigo-500' }) {
    return (
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
        </div>
    )
}

function EmptyNote() {
    return <p className="py-6 text-center text-sm text-gray-400">No data for this selection.</p>
}

// ── Insights panel ────────────────────────────────────────────────────────────

function Insights({ stats, loading, tab, onTab }) {
    const byCollege = stats?.by_college ?? []
    const maxCollege = Math.max(1, ...byCollege.map((c) => c.total))
    const byDept = stats?.by_department ?? []
    const maxDept = Math.max(1, ...byDept.map((d) => d.total))
    const byGender = stats?.by_gender ?? []
    const genderTotal = byGender.reduce((s, g) => s + Number(g.total), 0)
    const byStatus = Object.entries(stats?.by_status ?? {}).sort((a, b) => b[1] - a[1])
    const statusTotal = byStatus.reduce((s, [, v]) => s + Number(v), 0)
    const byCategory = Object.entries(stats?.by_category ?? {})
    const categoryTotal = byCategory.reduce((s, [, v]) => s + Number(v), 0)

    return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-2 pt-2 [scrollbar-width:none]">
                {STAT_TABS.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => onTab(key)}
                        className={`relative inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition ${tab === key ? 'text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Icon size={14} /> {label}
                        {tab === key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-slate-900" />}
                    </button>
                ))}
            </div>

            <div className="p-4 sm:p-5">
                {loading ? (
                    <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />)}</div>
                ) : tab === 'college' ? (
                    byCollege.length === 0 ? <EmptyNote /> : (
                        <div className="divide-y divide-gray-100">
                            {byCollege.map((c) => {
                                const active = c.total - c.funded - c.rejected
                                const seg = (n) => `${(n / maxCollege) * 100}%`
                                return (
                                    <div key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                                        <div className="flex min-w-0 items-center gap-3 sm:w-72">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-bold text-white">{c.code}</span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-gray-900">{c.college_name}</p>
                                                <p className="text-[11px] text-gray-400">{c.total > 0 ? Math.round((c.funded / c.total) * 100) : 0}% funded</p>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
                                                <div className="bg-emerald-500" style={{ width: seg(c.funded) }} title={`${c.funded} funded`} />
                                                <div className="bg-indigo-400" style={{ width: seg(active) }} title={`${active} in progress`} />
                                                <div className="bg-red-400" style={{ width: seg(c.rejected) }} title={`${c.rejected} rejected`} />
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
                                                <span><span className="font-semibold text-emerald-600">{c.funded}</span> funded</span>
                                                <span><span className="font-semibold text-indigo-600">{active}</span> in progress</span>
                                                <span><span className="font-semibold text-red-600">{c.rejected}</span> rejected</span>
                                            </div>
                                        </div>
                                        <p className="text-right text-lg font-bold tabular-nums text-gray-900 sm:w-16">{c.total}</p>
                                    </div>
                                )
                            })}
                        </div>
                    )
                ) : tab === 'department' ? (
                    byDept.length === 0 ? <EmptyNote /> : (
                        <ol className="space-y-3">
                            {byDept.map((d, i) => (
                                <li key={d.id} className="flex items-center gap-3">
                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex items-baseline justify-between gap-3">
                                            <p className="min-w-0 truncate text-sm"><span className="font-medium text-gray-900">{d.department_name}</span> <span className="text-xs text-gray-400">· {d.college_name}</span></p>
                                            <p className="shrink-0 text-sm font-bold tabular-nums text-gray-800">{d.total}{d.funded > 0 && <span className="ml-1 text-[11px] font-medium text-emerald-600">{d.funded} funded</span>}</p>
                                        </div>
                                        <Bar pct={(d.total / maxDept) * 100} />
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )
                ) : tab === 'gender' ? (
                    byGender.length === 0 ? <EmptyNote /> : (
                        <>
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                {byGender.map((g) => {
                                    const cfg = {
                                        male: ['Male', User, 'bg-blue-100 text-blue-600', 'bg-blue-500'],
                                        female: ['Female', UserRound, 'bg-pink-100 text-pink-600', 'bg-pink-500'],
                                        other: ['Other', Users, 'bg-violet-100 text-violet-600', 'bg-violet-500'],
                                    }[g.gender] ?? ['Not specified', Users, 'bg-gray-100 text-gray-500', 'bg-gray-400']
                                    const [label, Icon, tone, bar] = cfg
                                    const pct = genderTotal > 0 ? Math.round((g.total / genderTotal) * 100) : 0
                                    return (
                                        <div key={g.gender} className="rounded-xl border border-gray-200 p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-medium text-gray-500">{label}</span>
                                                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}><Icon size={14} /></span>
                                            </div>
                                            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{g.total}<span className="ml-1 text-xs font-medium text-gray-400">{pct}%</span></p>
                                            <div className="mt-2"><Bar pct={pct} className={bar} /></div>
                                            <p className="mt-2 text-[11px] text-gray-500">{g.total > 0 ? Math.round((g.funded / g.total) * 100) : 0}% funded</p>
                                        </div>
                                    )
                                })}
                            </div>
                            {(() => {
                                const male = Number(byGender.find((g) => g.gender === 'male')?.total || 0)
                                const female = Number(byGender.find((g) => g.gender === 'female')?.total || 0)
                                const femalePct = male + female > 0 ? Math.round((female / (male + female)) * 100) : 0
                                const tone = femalePct >= 40 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : femalePct >= 30 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'
                                return (
                                    <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${tone}`}>
                                        <span className="font-semibold">Gender equity:</span> women lead <span className="font-semibold">{femalePct}%</span> of proposals.
                                        {femalePct >= 40 ? ' A good balance.' : femalePct >= 30 ? ' Consider encouraging more women to apply.' : ' A significant gap — action is recommended.'}
                                    </p>
                                )
                            })()}
                        </>
                    )
                ) : tab === 'status' ? (
                    byStatus.length === 0 ? <EmptyNote /> : (
                        <>
                            <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-gray-100">
                                {byStatus.map(([s, n]) => <div key={s} className={statusStyle(s).bar} style={{ width: `${(n / statusTotal) * 100}%` }} title={`${getStatusLabel(s)}: ${n}`} />)}
                            </div>
                            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                                {byStatus.map(([s, n]) => (
                                    <div key={s} className="flex items-center gap-3 text-sm">
                                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusStyle(s).dot}`} />
                                        <span className="flex-1 truncate text-gray-700">{getStatusLabel(s)}</span>
                                        <span className="font-semibold tabular-nums text-gray-900">{n}</span>
                                        <span className="w-10 text-right text-xs tabular-nums text-gray-400">{statusTotal > 0 ? Math.round((n / statusTotal) * 100) : 0}%</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )
                ) : (
                    byCategory.length === 0 ? <EmptyNote /> : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {byCategory.map(([c, n]) => {
                                const style = categoryStyle(c)
                                const Icon = style.icon
                                return (
                                    <div key={c} className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
                                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tile}`}><Icon size={18} /></span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-medium text-gray-500">{getCategoryLabel(c)}</p>
                                            <p className="text-xl font-bold tabular-nums text-gray-900">{n}<span className="ml-1 text-xs font-medium text-gray-400">{categoryTotal > 0 ? Math.round((n / categoryTotal) * 100) : 0}%</span></p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}

// ── Views ─────────────────────────────────────────────────────────────────────

function TableView({ proposals }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-3">Proposal</th>
                            <th className="px-3 py-3">Principal Investigator</th>
                            <th className="px-3 py-3">College</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3">Submitted</th>
                            <th className="w-10 px-3 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {proposals.map((p) => (
                            <tr key={p.id} className="group cursor-pointer transition hover:bg-slate-50/70" onClick={() => router.visit(`/proposals/${p.id}`)}>
                                <td className="max-w-md px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] font-semibold text-slate-500">{p.tracker_number}</span>
                                        <CategoryChip category={p.category} />
                                    </div>
                                    <Link href={`/proposals/${p.id}`} onClick={(e) => e.stopPropagation()}
                                        className="mt-1 line-clamp-2 font-medium leading-snug text-gray-900 group-hover:text-indigo-700">
                                        {p.title}
                                    </Link>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                        <PiAvatar name={p.pi?.name} />
                                        <span className="max-w-40 truncate text-gray-700">{p.pi?.name ?? '—'}</span>
                                    </div>
                                </td>
                                <td className="max-w-48 truncate px-3 py-3 text-gray-600">{p.college?.name ?? '—'}</td>
                                <td className="px-3 py-3"><StatusPill status={p.status} /></td>
                                <td className="whitespace-nowrap px-3 py-3 text-gray-500">{fmtDate(p.submitted_at)}</td>
                                <td className="px-3 py-3 text-right">
                                    <ArrowRight size={15} className="inline text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Phones */}
            <ul className="divide-y divide-gray-100 md:hidden">
                {proposals.map((p) => (
                    <li key={p.id}>
                        <Link href={`/proposals/${p.id}`} className="block px-4 py-3.5 active:bg-gray-50">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] font-semibold text-slate-500">{p.tracker_number}</span>
                                <StatusPill status={p.status} />
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{p.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                <CategoryChip category={p.category} />
                                {p.pi?.name && <span className="inline-flex items-center gap-1"><User size={11} /> {p.pi.name}</span>}
                                {p.college?.name && <span className="inline-flex items-center gap-1"><Building2 size={11} /> {p.college.name}</span>}
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function CardView({ proposals }) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {proposals.map((p) => (
                <Link key={p.id} href={`/proposals/${p.id}`}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg">
                    <span className={`absolute inset-x-0 top-0 h-1 ${statusStyle(p.status).bar}`} />
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-slate-500">{p.tracker_number}</span>
                        <StatusPill status={p.status} />
                    </div>
                    <h3 className="mt-3 line-clamp-2 font-semibold leading-snug text-gray-900 group-hover:text-indigo-700">{p.title}</h3>
                    <div className="mt-2"><CategoryChip category={p.category} /></div>
                    <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
                        <PiAvatar name={p.pi?.name} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-700">{p.pi?.name ?? '—'}</p>
                            <p className="truncate text-[11px] text-gray-400">{p.college?.name ?? '—'}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-gray-400">{fmtDate(p.submitted_at)}</span>
                    </div>
                </Link>
            ))}
        </div>
    )
}

function KanbanView({ proposals }) {
    const grouped = KANBAN_COLUMNS.map((key) => [key, proposals.filter((p) => p.status === key)])
    const shown = grouped.filter(([, list]) => list.length > 0)

    return (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
            {(shown.length ? shown : grouped.slice(0, 5)).map(([key, list]) => (
                <div key={key} className="flex w-72 shrink-0 flex-col rounded-2xl border border-gray-200 bg-gray-50/70">
                    <div className="flex items-center justify-between px-3.5 py-3">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                            <span className={`h-2 w-2 rounded-full ${statusStyle(key).dot}`} /> {getStatusLabel(key)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-500 ring-1 ring-gray-200">{list.length}</span>
                    </div>
                    <div className="flex min-h-24 flex-col gap-2 px-2.5 pb-2.5">
                        {list.length === 0 ? (
                            <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-300">Empty</div>
                        ) : list.map((p) => (
                            <Link key={p.id} href={`/proposals/${p.id}`}
                                className="group block rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] font-semibold text-slate-500">{p.tracker_number}</span>
                                    <ArrowRight size={12} className="text-gray-300 group-hover:text-indigo-500" />
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-gray-800">{p.title}</p>
                                <div className="mt-2 flex items-center gap-1.5">
                                    <PiAvatar name={p.pi?.name} />
                                    <span className="truncate text-[11px] text-gray-500">{p.pi?.name ?? '—'}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function LoadingList({ view }) {
    if (view === 'card') {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl border border-gray-200 bg-white" />)}
            </div>
        )
    }
    return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-4 last:border-0">
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                    </div>
                    <div className="hidden h-6 w-28 animate-pulse rounded-full bg-gray-100 md:block" />
                    <div className="hidden h-4 w-20 animate-pulse rounded bg-gray-100 md:block" />
                </div>
            ))}
        </div>
    )
}

/** Page numbers around the current one, with gaps. */
function pageList(current, last) {
    const pages = new Set([1, last, current - 1, current, current + 1])
    const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)
    return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['…', p] : [p]))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProposalIndex() {
    const { props: { app_settings }, url } = usePage()
    // current_academic_year is already shared via HandleInertiaRequests — no extra API call needed
    const currentAcademicYear = app_settings?.current_academic_year || ''
    // Links from reports open the list already filtered (e.g. /proposals?college_id=…&academic_year=…).
    const linked = new URLSearchParams(url.split('?')[1] ?? '')

    const { error } = useToast()
    const { hasPermission, accessScope, user } = useAuth()
    const isAdmin = hasPermission('proposals.view_any') && accessScope?.type !== 'own'

    const [view, setView] = useViewPreference('proposals_index', 'table')
    const [stats, setStats] = useState(null)
    const [proposals, setProposals] = useState([])
    const [pagination, setPagination] = useState(null)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)
    const [filters, setFilters] = useState(() => ({
        status: linked.get('status') ?? '',
        category: linked.get('category') ?? '',
        college_id: linked.get('college_id') ?? '',
        academic_year: linked.has('academic_year') ? linked.get('academic_year') : currentAcademicYear,
        search: linked.get('search') ?? '',
    }))
    const [searchInput, setSearchInput] = useState(() => linked.get('search') ?? '')
    const [colleges, setColleges] = useState([])
    const [academicYears, setAcademicYears] = useState(currentAcademicYear ? [currentAcademicYear] : [])
    const [showStats, setShowStats] = useState(true)
    const [activeStatTab, setActiveStatTab] = useState('college')
    const [exporting, setExporting] = useState(null)
    const [exportOpen, setExportOpen] = useState(false)

    useEffect(() => {
        if (user && !isAdmin) { window.location.href = '/my-proposals' }
    }, [user, isAdmin])

    useEffect(() => {
        api.get('/colleges').then((res) => setColleges(res.data?.data || [])).catch(() => {})
    }, [])

    // Search waits for a pause in typing instead of querying on every key.
    useEffect(() => {
        const t = setTimeout(() => setFilters((p) => (p.search === searchInput.trim() ? p : { ...p, search: searchInput.trim() })), 350)
        return () => clearTimeout(t)
    }, [searchInput])

    useEffect(() => { loadStats(filters.academic_year) }, [filters.academic_year])

    // A filter change means the current page number may no longer make sense.
    useEffect(() => { setPage(1) }, [filters.status, filters.category, filters.college_id, filters.academic_year, filters.search])

    useEffect(() => { loadProposals() }, [filters, page])

    const loadStats = async (academicYear) => {
        setStatsLoading(true)
        try {
            const res = await api.get('/proposals/statistics', { params: academicYear ? { academic_year: academicYear } : {} })
            const data = res.data?.data || null
            setStats(data)
            if (data?.available_years?.length) setAcademicYears(data.available_years)
        } catch (_) {}
        setStatsLoading(false)
    }

    const loadProposals = async () => {
        setLoading(true)
        try {
            const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), page }
            const res = await api.get('/proposals', { params })
            const data = res.data?.data || []
            if (Array.isArray(data)) {
                setProposals(data)
                setPagination(null)
            } else {
                setProposals(data?.data || [])
                setPagination(data)
            }
        } catch (_) {
            error('Failed to load proposals.')
        }
        setLoading(false)
    }

    const download = async (kind) => {
        setExporting(kind)
        setExportOpen(false)
        try {
            const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')))
            const token = localStorage.getItem('rtt_token')
            const url = kind === 'excel' ? `/api/v1/reports/proposals/export?${params}` : `/api/v1/reports/proposals/stats-pdf?${params}`
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            if (!res.ok) { error(kind === 'excel' ? 'Export failed. Please try again.' : 'PDF generation failed. Please try again.'); return }
            const blobUrl = URL.createObjectURL(await res.blob())
            const a = document.createElement('a')
            a.href = blobUrl
            a.download = kind === 'excel'
                ? `proposals_${new Date().toISOString().slice(0, 10)}.xlsx`
                : `Proposal-Statistics-${new Date().toISOString().slice(0, 10)}.pdf`
            a.click()
            URL.revokeObjectURL(blobUrl)
        } catch (_) {
            error('The download failed. Please try again.')
        } finally {
            setExporting(null)
        }
    }

    const setFilter = (key, value) => setFilters((p) => ({ ...p, [key]: value }))
    const toggleStatus = (value) => setFilter('status', filters.status === value ? '' : value)

    const activeFilters = useMemo(() => {
        const list = []
        if (filters.search) list.push(['search', `“${filters.search}”`])
        if (filters.status) list.push(['status', filters.status === UNDER_REVIEW ? 'Under review' : filters.status === FUNDED_GROUP ? 'Funded (all stages)' : getStatusLabel(filters.status)])
        if (filters.category) list.push(['category', getCategoryLabel(filters.category)])
        if (filters.college_id) list.push(['college_id', colleges.find((c) => String(c.id) === String(filters.college_id))?.name ?? 'College'])
        return list
    }, [filters, colleges])

    const clearFilter = (key) => {
        if (key === 'search') setSearchInput('')
        setFilter(key, '')
    }
    const clearAll = () => {
        setSearchInput('')
        setFilters((p) => ({ ...p, status: '', category: '', college_id: '', search: '' }))
    }

    if (!isAdmin && user) return null

    const totals = stats?.totals ?? {}
    const decided = Number(totals.funded || 0) + Number(totals.rejected || 0)
    const successRate = decided > 0 ? Math.round((Number(totals.funded || 0) / decided) * 100) : null
    const from = pagination ? (pagination.current_page - 1) * pagination.per_page + 1 : 1
    const to = pagination ? Math.min(pagination.total, pagination.current_page * pagination.per_page) : proposals.length
    const selectCls = 'min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-base sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200'

    return (
        <AppLayout breadcrumb="All Proposals">
            <div className="mx-auto max-w-7xl space-y-5">

                {/* Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-600 to-violet-600 shadow-sm shadow-indigo-200">
                            <FolderKanban size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">All Proposals</h1>
                            <p className="mt-0.5 text-sm text-gray-500">
                                {statsLoading ? 'Loading…' : `${totals.submitted || 0} submitted`}
                                {filters.academic_year && <span className="font-medium text-indigo-600"> · {filters.academic_year}</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={filters.academic_year} onChange={(e) => setFilter('academic_year', e.target.value)}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                            <option value="">All years</option>
                            {academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={() => setShowStats((v) => !v)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${showStats ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                            <SlidersHorizontal size={14} /> Insights
                        </button>
                        <div className="relative">
                            <button onClick={() => setExportOpen((v) => !v)} disabled={!!exporting}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">
                                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export <ChevronDown size={13} />
                            </button>
                            {exportOpen && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
                                    <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                                        <p className="border-b border-gray-100 px-4 py-2 text-[11px] text-gray-500">Current filters applied</p>
                                        {[
                                            ['excel', Files, 'bg-emerald-50 text-emerald-600', 'Excel list', 'Every proposal matching the filters'],
                                            ['pdf', FileText, 'bg-red-50 text-red-600', 'PDF statistics report', 'Formatted summary to print or share'],
                                        ].map(([kind, Icon, tone, label, hint]) => (
                                            <button key={kind} onClick={() => download(kind)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50">
                                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={15} /></span>
                                                <span>
                                                    <span className="block text-sm font-medium text-gray-800">{label}</span>
                                                    <span className="block text-[11px] text-gray-400">{hint}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPIs — click to filter the list */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                    <Kpi icon={Files} label="Submitted" value={totals.submitted || 0} tone="bg-indigo-100 text-indigo-600" loading={statsLoading}
                        active={!filters.status} onClick={() => setFilter('status', '')} hint={successRate != null ? `${successRate}% success rate` : 'Excludes drafts'} />
                    <Kpi icon={Hourglass} label="Under review" value={totals.under_review || 0} tone="bg-amber-100 text-amber-600" loading={statsLoading}
                        active={filters.status === UNDER_REVIEW} onClick={() => toggleStatus(UNDER_REVIEW)} hint="Blind review, defence or central evaluation" />
                    <Kpi icon={Trophy} label="Funded" value={totals.funded || 0} tone="bg-emerald-100 text-emerald-600" loading={statsLoading}
                        active={filters.status === FUNDED_GROUP} onClick={() => toggleStatus(FUNDED_GROUP)} hint="Including running and completed" />
                    <Kpi icon={XCircle} label="Rejected" value={totals.rejected || 0} tone="bg-red-100 text-red-600" loading={statsLoading}
                        active={filters.status === 'rejected'} onClick={() => toggleStatus('rejected')} hint="Not selected" />
                    <Kpi icon={PencilLine} label="Drafts" value={totals.draft || 0} tone="bg-gray-100 text-gray-500" loading={statsLoading}
                        active={filters.status === 'draft'} onClick={() => toggleStatus('draft')} hint="Not yet submitted" />
                </div>

                {showStats && <Insights stats={stats} loading={statsLoading} tab={activeStatTab} onTab={setActiveStatTab} />}

                {/* Toolbar */}
                <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-200">
                            <Search size={15} className="shrink-0 text-gray-400" />
                            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by title or tracker number…"
                                className="w-full bg-transparent text-base focus:outline-none sm:text-sm" />
                            {searchInput && <button onClick={() => clearFilter('search')} aria-label="Clear search" className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
                            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectCls}>
                                <option value="">All statuses</option>
                                <option value={UNDER_REVIEW}>Under review (all stages)</option>
                                <option value={FUNDED_GROUP}>Funded (all stages)</option>
                                {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className={selectCls}>
                                <option value="">All categories</option>
                                {Object.keys(CATEGORY_STYLES).map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                            </select>
                            <select value={filters.college_id} onChange={(e) => setFilter('college_id', e.target.value)} className={`${selectCls} col-span-2 sm:col-span-1`}>
                                <option value="">All colleges</option>
                                {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end"><ViewToggle view={view} onChange={setView} /></div>
                    </div>
                    {activeFilters.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                            {activeFilters.map(([key, label]) => (
                                <span key={key} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1.5 text-xs font-medium text-indigo-700">
                                    {label}
                                    <button onClick={() => clearFilter(key)} aria-label={`Remove ${label}`} className="rounded-full p-0.5 hover:bg-indigo-100"><X size={12} /></button>
                                </span>
                            ))}
                            <button onClick={clearAll} className="text-xs font-medium text-gray-500 hover:text-gray-800">Clear all</button>
                        </div>
                    )}
                </div>

                {/* List */}
                {loading ? <LoadingList view={view} /> : proposals.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-14 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><Inbox size={22} className="text-gray-400" /></div>
                        <h3 className="font-semibold text-gray-700">No proposals found</h3>
                        <p className="mt-1 text-sm text-gray-400">{activeFilters.length ? 'Try a different search or clear the filters.' : 'Nothing has been submitted for this year yet.'}</p>
                        {activeFilters.length > 0 && <button onClick={clearAll} className="mt-4 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Clear filters</button>}
                    </div>
                ) : view === 'kanban' ? <KanbanView proposals={proposals} />
                    : view === 'card' ? <CardView proposals={proposals} />
                        : <TableView proposals={proposals} />}

                {/* Pagination */}
                {!loading && pagination && pagination.total > 0 && (
                    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                        <p className="text-xs text-gray-500">Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of <span className="font-semibold text-gray-700">{pagination.total}</span></p>
                        {pagination.last_page > 1 && (
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.current_page <= 1} aria-label="Previous page"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                                    <ChevronLeft size={15} />
                                </button>
                                {pageList(pagination.current_page, pagination.last_page).map((p, i) => p === '…'
                                    ? <span key={`gap-${i}`} className="px-1 text-xs text-gray-400">…</span>
                                    : (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold tabular-nums ${p === pagination.current_page ? 'bg-slate-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                            {p}
                                        </button>
                                    ))}
                                <button onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))} disabled={pagination.current_page >= pagination.last_page} aria-label="Next page"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
