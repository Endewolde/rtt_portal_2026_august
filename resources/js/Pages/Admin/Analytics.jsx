import { useState, useEffect, useCallback } from 'react'
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
    BarChart3, RefreshCw, Filter, TrendingUp, Wallet, Timer, Users, Layers,
    GitBranch, Building2, CalendarRange, FlaskConical, LineChart as LineIcon, Info,
    CheckCircle2, XCircle, Hourglass, Send, Percent,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { get } from '../../lib/api'
import { useToast } from '../../Components/Toast'
import { getCategoryLabel } from '../../lib/utils'

// One meaning per colour across the page: outcomes use status colours, single series use the primary.
const C = {
    funded: '#059669',
    inProgress: '#94a3b8',
    rejected: '#e11d48',
    primary: '#4f46e5',
    target: '#f59e0b',
}

const TOOLTIP = {
    contentStyle: { borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' },
    labelStyle: { fontWeight: 600, color: '#111827', marginBottom: 4 },
    cursor: { fill: '#f8fafc' },
}

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`)
const num = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString())
const money = (v) => {
    if (v === null || v === undefined) return '—'
    const n = Number(v)
    if (n >= 1_000_000) return `ETB ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
    if (n >= 1_000) return `ETB ${(n / 1_000).toFixed(0)}K`
    return `ETB ${n.toLocaleString()}`
}
const titleCase = (s) => (s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : '—')

function Skeleton({ height = 240 }) {
    return <div className="animate-pulse rounded-xl bg-gray-100" style={{ height }} />
}

function Empty({ text = 'No proposals match these filters yet.' }) {
    return <div className="flex h-40 items-center justify-center text-sm text-gray-400">{text}</div>
}

function Card({ title, desc, icon: Icon, children, action, className = '' }) {
    return (
        <section className={`overflow-hidden rounded-2xl border border-gray-200 bg-white ${className}`}>
            <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icon size={15} /></span>
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
                        {desc && <p className="text-xs text-gray-500">{desc}</p>}
                    </div>
                </div>
                {action}
            </header>
            <div className="p-5">{children}</div>
        </section>
    )
}

function Kpi({ icon: Icon, label, value, hint, tone = 'text-gray-900' }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><Icon size={13} /> {label}</div>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
            {hint && <p className="mt-0.5 text-[11px] leading-snug text-gray-400">{hint}</p>}
        </div>
    )
}

/** A single funded / in progress / rejected bar, with the numbers in the tooltip. */
function OutcomeBar({ row }) {
    const total = row.submitted || 0
    if (!total) return <div className="h-2 rounded-full bg-gray-100" />
    const part = (n) => `${(n / total) * 100}%`
    return (
        <div className="flex h-2 overflow-hidden rounded-full bg-gray-100" title={`${row.funded} funded · ${row.in_progress} in progress · ${row.rejected} not selected`}>
            <div style={{ width: part(row.funded), background: C.funded }} />
            <div style={{ width: part(row.in_progress), background: C.inProgress }} className="border-l-2 border-white first:border-0" />
            <div style={{ width: part(row.rejected), background: C.rejected }} className="border-l-2 border-white first:border-0" />
        </div>
    )
}

function OutcomeLegend() {
    return (
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
            {[['Funded', C.funded], ['In progress', C.inProgress], ['Not selected', C.rejected]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> {l}</span>
            ))}
        </div>
    )
}

/** Category / research type / gender / college rows: name, outcome bar, counts, pass rate. */
function BreakdownTable({ rows, nameKey, format = (v) => v, emptyText }) {
    if (!rows?.length) return <Empty text={emptyText} />
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-130 text-sm">
                <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                        <th className="pb-2 pr-3">Name</th>
                        <th className="w-1/3 pb-2 pr-3">Outcomes</th>
                        <th className="pb-2 pr-3 text-right">Submitted</th>
                        <th className="pb-2 pr-3 text-right">Funded</th>
                        <th className="pb-2 pr-3 text-right">Not selected</th>
                        <th className="pb-2 text-right">Pass rate</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((r) => (
                        <tr key={r[nameKey]}>
                            <td className="py-2.5 pr-3 font-medium text-gray-800">{format(r[nameKey])}</td>
                            <td className="py-2.5 pr-3"><OutcomeBar row={r} /></td>
                            <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700">{r.submitted}</td>
                            <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700">{r.funded}</td>
                            <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700">{r.rejected}</td>
                            <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900" title={`${r.funded} of ${r.decided} decided`}>{pct(r.pass_rate)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function Funnel({ steps }) {
    const max = Math.max(1, steps[0]?.count ?? 0)
    return (
        <ol className="space-y-3">
            {steps.map((s, i) => {
                const prev = steps[i - 1]
                const conversion = prev && prev.count > 0 ? Math.round((s.count / prev.count) * 100) : null
                return (
                    <li key={s.key}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                            <span className="font-medium text-gray-700">{s.label}</span>
                            <span className="tabular-nums text-gray-500">
                                <span className="font-semibold text-gray-900">{num(s.count)}</span>
                                {conversion !== null && <span className="ml-2 text-gray-400">{conversion}% of previous</span>}
                            </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-r-md bg-gray-100">
                            <div className="h-full rounded-r-md" style={{ width: `${(s.count / max) * 100}%`, background: i === steps.length - 1 ? C.funded : C.primary }} />
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}

function StageTimes({ stages }) {
    const rows = stages.filter((s) => s.count > 0)
    if (!rows.length) return <Empty text="No completed stages yet." />
    const scale = Math.max(...rows.map((s) => Math.max(s.median ?? 0, s.target))) * 1.15
    return (
        <div className="space-y-3">
            {rows.map((s) => {
                const over = s.median !== null && s.median > s.target
                return (
                    <div key={s.label}>
                        <div className="mb-1 flex justify-between text-xs">
                            <span className="font-medium text-gray-700">{s.label}</span>
                            <span className={`tabular-nums ${over ? 'font-semibold text-rose-600' : 'text-gray-500'}`}>
                                {s.median ?? '—'}d median · target {s.target}d{over ? ' · over target' : ''}
                            </span>
                        </div>
                        <div className="relative h-2.5 rounded-full bg-gray-100">
                            <div className="h-full rounded-full" style={{ width: `${((s.median ?? 0) / scale) * 100}%`, background: over ? C.rejected : C.primary }} />
                            <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-amber-500" style={{ left: `${(s.target / scale) * 100}%` }} title={`Target ${s.target} days`} />
                        </div>
                    </div>
                )
            })}
            <p className="flex items-center gap-1.5 pt-1 text-[11px] text-gray-400"><span className="inline-block h-3 w-0.5 bg-amber-500" /> Target time for the stage</p>
        </div>
    )
}

export default function Analytics() {
    const { error } = useToast()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({ academic_year: '', category: '', college_id: '' })
    const [showAllColleges, setShowAllColleges] = useState(false)

    const load = useCallback((next) => {
        setLoading(true)
        const params = {}
        if (next?.academic_year) params.academic_year = next.academic_year
        if (next?.category) params.category = next.category
        if (next?.college_id) params.college_id = next.college_id

        get('/admin/analytics', params)
            .then((r) => {
                const d = r.data ?? {}
                setData(d)
                setFilters({
                    academic_year: d.filters?.academic_year ?? 'all',
                    category: d.filters?.category ?? '',
                    college_id: d.filters?.college_id ?? '',
                })
            })
            .catch(() => error('Failed to load analytics.'))
            .finally(() => setLoading(false))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load() }, [load])

    const change = (key, value) => {
        const next = { ...filters, [key]: value }
        setFilters(next)
        load(next)
    }

    const f = data?.filters ?? {}
    const s = data?.summary
    const collegeRows = (data?.colleges ?? []).filter((c) => showAllColleges || c.submitted > 0)
    const collegeChart = (data?.colleges ?? []).filter((c) => c.submitted > 0).slice(0, 12)
    const scopeText = [
        f.academic_year ? `${f.academic_year} academic year` : 'All academic years',
        f.category ? getCategoryLabel(f.category) : 'All categories',
        f.college_id ? (data?.college_options?.find((c) => c.id === f.college_id)?.name ?? 'One college') : 'All colleges',
    ].join(' · ')

    const select = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400'

    return (
        <AppLayout breadcrumb="Analytics Dashboard">
            <div className="mx-auto max-w-7xl">
                {/* Header + filters */}
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100"><BarChart3 size={20} className="text-indigo-600" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Analytics Dashboard</h1>
                            <p className="mt-0.5 text-sm text-gray-500">{scopeText}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Filter size={14} className="hidden text-gray-400 sm:block" />
                        <select aria-label="Academic year" value={filters.academic_year || 'all'} onChange={(e) => change('academic_year', e.target.value)} className={select}>
                            <option value="all">All years</option>
                            {(data?.academicYears ?? []).map((y) => (
                                <option key={y} value={y}>{y}{y === f.current_academic_year ? ' (current)' : ''}</option>
                            ))}
                        </select>
                        <select aria-label="Category" value={filters.category} onChange={(e) => change('category', e.target.value)} disabled={f.category_locked} className={select}>
                            <option value="">All categories</option>
                            {['research', 'community_engagement', 'technology_transfer'].map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                        </select>
                        <select aria-label="College" value={filters.college_id} onChange={(e) => change('college_id', e.target.value)} disabled={f.college_locked} className={`${select} max-w-56`}>
                            <option value="">All colleges</option>
                            {(data?.college_options ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={() => load(filters)} disabled={loading} aria-label="Refresh"
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {!data ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={96} />)}</div>
                        <Skeleton height={280} />
                    </div>
                ) : (
                    <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
                        {/* KPIs */}
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                            <Kpi icon={Send} label="Submitted" value={num(s.submitted)} hint="All proposals except drafts" />
                            <Kpi icon={CheckCircle2} label="Funded" value={num(s.funded)} hint="Funded, at mid-term or completed" tone="text-emerald-700" />
                            <Kpi icon={XCircle} label="Not selected" value={num(s.rejected)} hint="Rejected at any stage" tone="text-rose-700" />
                            <Kpi icon={Hourglass} label="In progress" value={num(s.in_progress)} hint="Still in review or awaiting a decision" />
                            <Kpi icon={Percent} label="Pass rate" value={pct(s.pass_rate)} hint={s.decided ? `Funded ÷ decided (${s.funded} of ${s.decided})` : 'No decisions yet'} tone="text-indigo-700" />
                        </div>

                        {/* Funnel + current pipeline */}
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                            <Card className="lg:col-span-3" icon={GitBranch} title="Proposal Funnel" desc="How far proposals got. Rejected proposals count up to the stage they stopped at.">
                                {s.submitted ? <Funnel steps={data.funnel} /> : <Empty />}
                            </Card>
                            <Card className="lg:col-span-2" icon={Layers} title="Where Proposals Are Now" desc="Current stage of every submitted proposal">
                                {s.submitted ? (
                                    <ul className="space-y-2.5">
                                        {data.pipeline.map((p) => (
                                            <li key={p.key} className="flex items-center gap-3 text-sm">
                                                <span className="w-36 shrink-0 text-gray-700">{p.label}</span>
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                                    <div className="h-full rounded-full" style={{
                                                        width: `${(p.count / Math.max(1, s.submitted)) * 100}%`,
                                                        background: p.key === 'funded' ? C.funded : p.key === 'rejected' ? C.rejected : C.primary,
                                                    }} />
                                                </div>
                                                <span className="w-8 text-right font-semibold tabular-nums text-gray-900">{p.count}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <Empty />}
                            </Card>
                        </div>

                        {/* Money */}
                        <Card icon={Wallet} title="Funding" desc="Funded proposals in the current filters">
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                                {[
                                    ['Requested', money(data.money.requested), 'Itemised budgets of funded proposals'],
                                    ['Awarded', money(data.money.awarded), `${data.money.awards} award${data.money.awards === 1 ? '' : 's'}`],
                                    ['Disbursed', money(data.money.disbursed), data.money.disbursed_ratio !== null ? `${data.money.disbursed_ratio}% of awarded` : 'Nothing awarded yet'],
                                    ['Awarded vs requested', pct(data.money.award_ratio), 'Where both a budget and an award exist'],
                                    ['Average award', money(data.money.average_award), 'Per funded proposal'],
                                ].map(([label, value, hint]) => (
                                    <div key={label} className="rounded-xl bg-gray-50 px-4 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                                        <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{value}</p>
                                        <p className="text-[11px] text-gray-400">{hint}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Categories */}
                        {!f.category && (
                            <Card icon={Layers} title="By Category" desc="Outcomes for each proposal category" action={<OutcomeLegend />}>
                                <BreakdownTable rows={data.categories} nameKey="category" format={getCategoryLabel} />
                            </Card>
                        )}

                        {/* Colleges */}
                        {!f.college_id && (
                            <Card icon={Building2} title="By College" desc="Outcomes per college, busiest first"
                                action={
                                    <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
                                        <input type="checkbox" checked={showAllColleges} onChange={(e) => setShowAllColleges(e.target.checked)} className="rounded border-gray-300" />
                                        Show colleges with no proposals
                                    </label>
                                }>
                                {collegeChart.length > 0 && (
                                    <ResponsiveContainer width="100%" height={Math.max(160, collegeChart.length * 34)}>
                                        <BarChart data={collegeChart} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
                                            <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <YAxis type="category" dataKey="code" width={64} tick={{ fontSize: 11, fill: '#334155' }} tickLine={false} axisLine={false} />
                                            <Tooltip {...TOOLTIP} labelFormatter={(code) => collegeChart.find((c) => c.code === code)?.college ?? code} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Bar dataKey="funded" name="Funded" stackId="o" fill={C.funded} stroke="#fff" strokeWidth={2} />
                                            <Bar dataKey="in_progress" name="In progress" stackId="o" fill={C.inProgress} stroke="#fff" strokeWidth={2} />
                                            <Bar dataKey="rejected" name="Not selected" stackId="o" fill={C.rejected} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                                <div className={collegeChart.length ? 'mt-5' : ''}>
                                    <BreakdownTable rows={collegeRows} nameKey="college" emptyText="No college has submitted proposals in these filters." />
                                </div>
                            </Card>
                        )}

                        {/* Years */}
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            <Card icon={CalendarRange} title="Outcomes by Academic Year" desc="Every year, regardless of the year filter">
                                {data.years.length ? (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <BarChart data={data.years} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="academic_year" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <Tooltip {...TOOLTIP} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Bar dataKey="funded" name="Funded" stackId="y" fill={C.funded} stroke="#fff" strokeWidth={2} />
                                            <Bar dataKey="in_progress" name="In progress" stackId="y" fill={C.inProgress} stroke="#fff" strokeWidth={2} />
                                            <Bar dataKey="rejected" name="Not selected" stackId="y" fill={C.rejected} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <Empty />}
                            </Card>
                            <Card icon={TrendingUp} title="Pass Rate by Academic Year" desc="Funded ÷ decided — years still in review can change">
                                {data.years.some((y) => y.pass_rate !== null) ? (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <LineChart data={data.years} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                                            <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="academic_year" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <Tooltip {...TOOLTIP} cursor={{ stroke: '#cbd5e1' }} formatter={(v, _n, p) => [`${v}% (${p.payload.funded} of ${p.payload.decided} decided)`, 'Pass rate']} />
                                            <Line type="monotone" dataKey="pass_rate" name="Pass rate" stroke={C.primary} strokeWidth={2} dot={{ r: 4, fill: C.primary, stroke: '#fff', strokeWidth: 2 }} connectNulls />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : <Empty text="No decisions yet." />}
                            </Card>
                        </div>

                        {/* Monthly submissions */}
                        <Card icon={LineIcon} title="Monthly Submissions" desc="Proposals submitted each month over the last two years">
                            {data.monthly.some((m) => m.submitted > 0) ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={data.monthly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gMonthly" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={C.primary} stopOpacity={0.2} />
                                                <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                        <Tooltip {...TOOLTIP} cursor={{ stroke: '#cbd5e1' }} />
                                        <Area type="monotone" dataKey="submitted" name="Submitted" stroke={C.primary} strokeWidth={2} fill="url(#gMonthly)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <Empty text="No submissions in the last two years." />}
                        </Card>

                        {/* Review process */}
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                            <Card className="lg:col-span-3" icon={Timer} title="Time per Stage" desc="Median days a proposal spends in each stage, against its target">
                                <StageTimes stages={data.review.stages} />
                            </Card>
                            <Card className="lg:col-span-2" icon={Users} title="Review Quality" desc="Reviewer workload, speed and agreement">
                                <dl className="grid grid-cols-2 gap-3">
                                    {[
                                        ['Reviewers', num(data.review.reviewers)],
                                        ['Reviews per reviewer', data.review.reviews_per_reviewer ?? '—'],
                                        ['Average days per review', data.review.average_review_days ?? '—'],
                                        ['Submitted on time', pct(data.review.on_time_rate)],
                                        ['Reviews overdue now', num(data.review.overdue_reviews)],
                                        ['Blind reviewer disagreement', pct(data.review.disagreement_rate)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-xl bg-gray-50 px-3 py-2.5">
                                            <dt className="text-[11px] text-gray-500">{label}</dt>
                                            <dd className="text-base font-bold tabular-nums text-gray-900">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </Card>
                        </div>

                        {/* Research type + gender */}
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            <Card icon={FlaskConical} title="By Research Type" action={<OutcomeLegend />}>
                                <BreakdownTable rows={data.researchTypes} nameKey="research_type" />
                            </Card>
                            <Card icon={Users} title="By PI Gender" desc="Principal investigator of each proposal">
                                <BreakdownTable rows={data.gender} nameKey="gender" format={titleCase} />
                            </Card>
                        </div>

                        {/* Forecast */}
                        <Card icon={TrendingUp} title="Submissions Forecast" desc="Trend from completed academic years only">
                            {data.forecast.available ? (
                                <>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <BarChart
                                            data={[
                                                ...data.forecast.history.map((h) => ({ year: h.year, actual: h.actual })),
                                                ...data.forecast.predictions.map((p) => ({ year: p.year, predicted: p.predicted })),
                                            ]}
                                            margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
                                        >
                                            <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <Tooltip {...TOOLTIP} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Bar dataKey="actual" name="Submitted" fill={C.primary} radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="predicted" name="Forecast" fill="#c7d2fe" stroke={C.primary} strokeDasharray="4 3" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <p className="mt-3 text-xs text-gray-500">
                                        Trend: {data.forecast.slope > 0 ? '+' : ''}{data.forecast.slope} proposals per year · fit {data.forecast.r_squared} (1 = perfect).
                                        A simple straight-line estimate — use it as a guide for planning, not a commitment.
                                    </p>
                                </>
                            ) : (
                                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
                                    <span>No forecast yet. {data.forecast.reason}</span>
                                </div>
                            )}
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
