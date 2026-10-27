import { useState, useEffect } from 'react'
import { Link, usePage } from '@inertiajs/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Building2, Users, Files, Trophy, Hourglass, XCircle, BarChart2, Layers, Tags, ArrowRight } from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import InsightsNav from '../../Components/InsightsNav'
import { PageHeader, Select, RefreshButton, StatCard, Panel, EmptyState, StatSkeletons, Skeleton, DataTable, CHART } from '../../Components/Insights/Kit'
import { useToast } from '../../Components/Toast'
import { get } from '../../lib/api'
import { getStatusLabel, getCategoryLabel } from '../../lib/utils'
import { term } from '../../lib/terms'

const STATUS_COLOR = {
    submitted: '#6366f1', validated: '#3b82f6', under_blind_review: '#8b5cf6', blind_review_passed: '#06b6d4',
    under_open_defence: '#f59e0b', accepted: '#14b8a6', funded: '#22c55e', midterm_evaluation: '#10b981',
    completed: '#64748b', rejected: '#ef4444', archived: '#94a3b8',
}
const GENDER = { male: ['Male', '#6366f1'], female: ['Female', '#ec4899'], other: ['Other', '#8b5cf6'], not_specified: ['Not specified', '#94a3b8'] }

function RateChip({ rate }) {
    const tone = rate >= 50 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : rate >= 25 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-gray-50 text-gray-500 ring-gray-200'
    return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${tone}`}>{rate}%</span>
}

export default function CollegeDashboard() {
    const { error } = useToast()
    const currentAcademicYear = usePage().props.app_settings?.current_academic_year ?? ''
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [year, setYear] = useState(currentAcademicYear)

    const load = async () => {
        setLoading(true)
        try {
            // get() already unwraps to the JSON body ({ data, message, errors, meta }) — r.data IS the payload.
            const r = await get('/proposals/statistics', year ? { academic_year: year } : {})
            setStats(r.data ?? null)
        } catch { error('Failed to load statistics.') }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

    const totals = stats?.totals ?? {}
    const submitted = Number(totals.submitted || 0)
    const decided = Number(totals.funded || 0) + Number(totals.rejected || 0)
    const successRate = decided > 0 ? Math.round((Number(totals.funded || 0) / decided) * 100) : null

    const departments = stats?.by_department ?? []
    const byDept = departments.map((d) => ({ name: d.department_name ?? d.code, Total: Number(d.total), Funded: Number(d.funded) }))
    const byStatus = Object.entries(stats?.by_status ?? {}).map(([k, v]) => ({ key: k, name: getStatusLabel(k), value: Number(v), fill: STATUS_COLOR[k] ?? '#6366f1' }))
    const statusTotal = byStatus.reduce((s, x) => s + x.value, 0)
    const byCategory = Object.entries(stats?.by_category ?? {}).map(([k, v]) => ({ key: k, name: getCategoryLabel(k), value: Number(v) }))
    const categoryTotal = byCategory.reduce((s, x) => s + x.value, 0)
    const byGender = (stats?.by_gender ?? []).map((g) => ({ name: (GENDER[g.gender] ?? GENDER.not_specified)[0], value: Number(g.total), funded: Number(g.funded), fill: (GENDER[g.gender] ?? GENDER.not_specified)[1] }))
    const genderTotal = byGender.reduce((s, x) => s + x.value, 0)

    // Only years that actually have proposals, always including the one selected.
    const years = [...new Set([year, ...(stats?.available_years ?? [])].filter(Boolean))]
    const yearQuery = year ? `&academic_year=${year}` : ''

    return (
        <AppLayout breadcrumb="College Dashboard">
            <InsightsNav />
            <div className="mx-auto max-w-7xl space-y-6">
                <PageHeader icon={Building2} color="sky" title="College Research Dashboard" description="Proposals from researchers in your college — departments, stages, categories and gender.">
                    <Select label={term('academic_year')} value={year} onChange={setYear}>
                        <option value="">All {term('academic_year', { plural: true, lower: true })}</option>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </Select>
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {loading && !stats ? <StatSkeletons /> : (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard icon={Files} color="indigo" label="Submitted" value={submitted} hint={`${Number(totals.draft || 0)} more still in draft`} href={`/proposals?${yearQuery.slice(1)}`} />
                        <StatCard icon={Trophy} color="emerald" label="Funded" value={Number(totals.funded || 0)} hint={successRate != null ? `${successRate}% of decided proposals` : 'None decided yet'} />
                        <StatCard icon={Hourglass} color="amber" label="Under review" value={Number(totals.under_review || 0)} hint="Blind review to central evaluation" />
                        <StatCard icon={XCircle} color="red" label="Rejected" value={Number(totals.rejected || 0)} href={`/proposals?status=rejected${yearQuery}`} />
                    </div>
                )}

                <div className={`grid gap-6 lg:grid-cols-5 ${loading && stats ? 'opacity-60 transition' : ''}`}>
                    <Panel title="Proposals by department" subtitle="Submitted and funded" icon={BarChart2} className="lg:col-span-3">
                        {loading && !stats ? <Skeleton className="h-64" /> : byDept.length === 0 ? <EmptyState icon={BarChart2} title="No proposals yet" /> : (
                            <ResponsiveContainer width="100%" height={Math.max(220, byDept.length * 38)}>
                                <BarChart data={byDept} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2}>
                                    <CartesianGrid {...CHART.grid} horizontal={false} vertical />
                                    <XAxis type="number" allowDecimals={false} {...CHART.axis} />
                                    <YAxis type="category" dataKey="name" width={150} {...CHART.yAxis} tick={{ fontSize: 11, fill: '#4b5563' }} />
                                    <Tooltip {...CHART.tooltip} />
                                    <Legend {...CHART.legend} />
                                    <Bar dataKey="Total" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={14} />
                                    <Bar dataKey="Funded" fill="#22c55e" radius={[0, 6, 6, 0]} maxBarSize={14} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Panel>

                    <Panel title="Where proposals are" subtitle="By stage" icon={Layers} className="lg:col-span-2">
                        {loading && !stats ? <Skeleton className="h-64" /> : byStatus.length === 0 ? <EmptyState icon={Layers} title="No proposals yet" /> : (
                            <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                                <div className="relative h-44 w-44 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={byStatus} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                                                {byStatus.map((s) => <Cell key={s.key} fill={s.fill} />)}
                                            </Pie>
                                            <Tooltip {...CHART.tooltip} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-bold tabular-nums text-gray-900">{statusTotal}</span>
                                        <span className="text-[10px] uppercase tracking-wider text-gray-400">proposals</span>
                                    </div>
                                </div>
                                <ul className="w-full min-w-0 flex-1 space-y-1.5">
                                    {byStatus.sort((a, b) => b.value - a.value).map((s) => (
                                        <li key={s.key}>
                                            <Link href={`/proposals?status=${s.key}${yearQuery}`} className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-xs hover:bg-gray-50">
                                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.fill }} />
                                                <span className="flex-1 truncate text-gray-600">{s.name}</span>
                                                <span className="font-semibold tabular-nums text-gray-900">{s.value}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Panel>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Panel title="By category" icon={Tags}>
                        {loading && !stats ? <Skeleton className="h-32" /> : byCategory.length === 0 ? <EmptyState icon={Tags} title="No proposals yet" /> : (
                            <div className="space-y-4">
                                {byCategory.map((c) => {
                                    const pct = categoryTotal > 0 ? Math.round((c.value / categoryTotal) * 100) : 0
                                    return (
                                        <Link key={c.key} href={`/proposals?category=${c.key}${yearQuery}`} className="group block">
                                            <div className="mb-1 flex justify-between text-sm">
                                                <span className="text-gray-700 group-hover:text-gray-900">{c.name}</span>
                                                <span className="font-semibold tabular-nums text-gray-900">{c.value} <span className="text-xs font-normal text-gray-400">{pct}%</span></span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                                <div className="h-full rounded-full bg-indigo-500 transition-all duration-700 group-hover:bg-indigo-600" style={{ width: `${pct}%` }} />
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </Panel>

                    <Panel title="Principal investigators by gender" icon={Users}>
                        {loading && !stats ? <Skeleton className="h-32" /> : byGender.length === 0 ? <EmptyState icon={Users} title="No proposals yet" /> : (
                            <div className="space-y-3">
                                <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
                                    {byGender.map((g) => <div key={g.name} style={{ width: `${(g.value / genderTotal) * 100}%`, background: g.fill }} title={`${g.name}: ${g.value}`} />)}
                                </div>
                                <ul className="grid gap-2 sm:grid-cols-2">
                                    {byGender.map((g) => (
                                        <li key={g.name} className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.fill }} />
                                            <span className="flex-1 text-sm text-gray-700">{g.name}</span>
                                            <span className="text-right">
                                                <span className="block text-sm font-bold tabular-nums text-gray-900">{g.value} <span className="text-xs font-normal text-gray-400">{genderTotal > 0 ? Math.round((g.value / genderTotal) * 100) : 0}%</span></span>
                                                <span className="block text-[10px] text-gray-400">{g.value > 0 ? Math.round((g.funded / g.value) * 100) : 0}% funded</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Panel>
                </div>

                {departments.length > 0 && (
                    <Panel title="Department breakdown" icon={Building2} bodyClassName=""
                        actions={<Link href={`/reports?type=college_performance${yearQuery}`} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">College performance report <ArrowRight size={13} /></Link>}>
                        <DataTable
                            rows={departments}
                            rowKey={(d) => d.id ?? d.department_name}
                            minWidth={420}
                            columns={[
                                { key: 'department_name', label: 'Department', render: (d) => <><p className="font-medium text-gray-900">{d.department_name}</p><p className="text-xs text-gray-400">{d.code}</p></> },
                                { key: 'total', label: 'Total', align: 'right', className: 'font-semibold text-gray-900' },
                                { key: 'funded', label: 'Funded', align: 'right', className: 'font-semibold text-emerald-600' },
                                { key: 'rate', label: 'Funded rate', align: 'right', render: (d) => <RateChip rate={d.total > 0 ? Math.round((d.funded / d.total) * 100) : 0} /> },
                            ]}
                        />
                    </Panel>
                )}
            </div>
        </AppLayout>
    )
}
