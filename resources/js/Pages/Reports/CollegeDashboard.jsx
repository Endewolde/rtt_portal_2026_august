import { useState, useEffect } from 'react'
import { usePage } from '@inertiajs/react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
    Building2, Users, TrendingUp, CheckCircle2, XCircle, Clock,
    BarChart2, Download, RefreshCw,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import { get } from '../../lib/api'
import { cn } from '../../lib/utils'

const STATUS_LABEL = {
    submitted:           'Submitted',
    validated:           'Validated',
    under_blind_review:  'Blind Review',
    blind_review_passed: 'Review Passed',
    under_open_defence:  'Open Defence',
    accepted:            'Central Evaluation',
    funded:              'Funded',
    midterm_evaluation:  'Midterm',
    completed:           'Completed',
    rejected:            'Rejected',
}

const STATUS_COLOR = {
    submitted:           '#6366f1',
    validated:           '#3b82f6',
    under_blind_review:  '#8b5cf6',
    blind_review_passed: '#06b6d4',
    under_open_defence:  '#f59e0b',
    accepted:            '#10b981',
    funded:              '#22c55e',
    midterm_evaluation:  '#14b8a6',
    completed:           '#64748b',
    rejected:            '#ef4444',
}

const CATEGORY_LABEL = {
    research:             'Research',
    community_engagement: 'Community',
    technology_transfer:  'Technology',
}

const GENDER_COLOR = { male: '#6366f1', female: '#ec4899', not_specified: '#94a3b8' }

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
    const colorMap = {
        indigo:  { bg: 'bg-indigo-600',  soft: 'bg-indigo-50',  text: 'text-indigo-600' },
        green:   { bg: 'bg-green-600',   soft: 'bg-green-50',   text: 'text-green-600'  },
        red:     { bg: 'bg-red-500',     soft: 'bg-red-50',     text: 'text-red-500'    },
        amber:   { bg: 'bg-amber-500',   soft: 'bg-amber-50',   text: 'text-amber-600'  },
        blue:    { bg: 'bg-blue-600',    soft: 'bg-blue-50',    text: 'text-blue-600'   },
    }
    const c = colorMap[color] ?? colorMap.indigo
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', c.bg)}>
                    <Icon size={16} className="text-white" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value ?? 0}</p>
            {sub != null && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    )
}

function ChartCard({ title, children }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-sm font-bold text-gray-800 mb-4">{title}</p>
            {children}
        </div>
    )
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
            const params = {}
            if (year) params.academic_year = year
            const r = await get('/proposals/statistics', params)
            // get() already unwraps to the JSON body ({ data, message, errors, meta }) —
            // r.data IS the payload; r.data.data was one level too deep and always
            // undefined, silently rendering every stat as its 0 fallback.
            setStats(r.data ?? null)
        } catch { error('Failed to load statistics.') }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [year])

    const totals = stats?.totals ?? {}
    const byDept = (stats?.by_department ?? []).map(d => ({
        name: d.department_name ?? d.code,
        Total: d.total,
        Funded: d.funded,
    }))
    const byStatus = Object.entries(stats?.by_status ?? {}).map(([k, v]) => ({
        name: STATUS_LABEL[k] ?? k,
        value: v,
        fill: STATUS_COLOR[k] ?? '#6366f1',
    }))
    const byCategory = Object.entries(stats?.by_category ?? {}).map(([k, v]) => ({
        name: CATEGORY_LABEL[k] ?? k,
        value: v,
    }))
    const byGender = (stats?.by_gender ?? []).map(g => ({
        name: g.gender === 'not_specified' ? 'N/A' : g.gender.charAt(0).toUpperCase() + g.gender.slice(1),
        value: g.total,
        fill: GENDER_COLOR[g.gender] ?? '#94a3b8',
    }))

    const successRate = totals.submitted > 0
        ? Math.round((totals.funded / totals.submitted) * 100)
        : 0

    // academic_year is stored (and set via app_settings.current_academic_year) as a
    // "YYYY-YYYY" range string, not a bare year — the dropdown must submit the same
    // format or the filter silently matches no proposals at all.
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 5 }, (_, i) => `${currentYear - i}-${currentYear - i + 1}`)

    return (
        <AppLayout breadcrumb="College Dashboard">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">College Research Dashboard</h1>
                        <p className="text-sm text-gray-500 mt-1">Proposals submitted by researchers in your college</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={year} onChange={e => setYear(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">All Years</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={load} disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard icon={TrendingUp}   label="Total Proposals"  value={totals.total}        color="indigo" />
                    <StatCard icon={CheckCircle2} label="Funded"            value={totals.funded}       color="green"
                        sub={`${successRate}% success rate`} />
                    <StatCard icon={Clock}        label="Under Review"      value={totals.under_review} color="amber" />
                    <StatCard icon={XCircle}      label="Rejected"          value={totals.rejected}     color="red"   />
                </div>

                {/* Charts row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* By department */}
                    <ChartCard title="Proposals by Department">
                        {byDept.length === 0 ? (
                            <div className="flex items-center justify-center h-40 text-gray-300">
                                <BarChart2 size={28} />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={byDept} margin={{ left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="Total"  fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Funded" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    {/* By status pie */}
                    <ChartCard title="Pipeline Status Breakdown">
                        {byStatus.length === 0 ? (
                            <div className="flex items-center justify-center h-40 text-gray-300">
                                <BarChart2 size={28} />
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <ResponsiveContainer width="55%" height={220}>
                                    <PieChart>
                                        <Pie data={byStatus} dataKey="value" cx="50%" cy="50%"
                                            innerRadius={50} outerRadius={80} paddingAngle={2}>
                                            {byStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                        </Pie>
                                        <Tooltip formatter={(v, n) => [v, n]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-1.5 min-w-0">
                                    {byStatus.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: s.fill }} />
                                                <span className="text-[11px] text-gray-600 truncate">{s.name}</span>
                                            </div>
                                            <span className="text-[11px] font-bold text-gray-800 shrink-0">{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </ChartCard>
                </div>

                {/* Charts row 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* By category */}
                    <ChartCard title="Proposals by Research Category">
                        {byCategory.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-gray-300">
                                <BarChart2 size={24} />
                            </div>
                        ) : (
                            <div className="space-y-3 py-1">
                                {byCategory.map(c => {
                                    const pct = totals.total > 0 ? Math.round((c.value / totals.total) * 100) : 0
                                    return (
                                        <div key={c.name}>
                                            <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                                                <span>{c.name}</span>
                                                <span>{c.value} ({pct}%)</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 rounded-full transition-all"
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </ChartCard>

                    {/* By gender */}
                    <ChartCard title="Gender Distribution of Principal Investigators">
                        {byGender.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-gray-300">
                                <Users size={24} />
                            </div>
                        ) : (
                            <div className="flex items-center gap-6">
                                <ResponsiveContainer width="50%" height={160}>
                                    <PieChart>
                                        <Pie data={byGender} dataKey="value" cx="50%" cy="50%"
                                            outerRadius={65} paddingAngle={3}>
                                            {byGender.map((g, i) => <Cell key={i} fill={g.fill} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-3">
                                    {byGender.map((g, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded-full" style={{ background: g.fill }} />
                                                <span className="text-xs text-gray-600">{g.name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-gray-800">{g.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </ChartCard>
                </div>

                {/* Department detail table */}
                {byDept.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <p className="text-sm font-bold text-gray-800">Department Breakdown</p>
                        </div>
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Funded</th>
                                        <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(stats?.by_department ?? []).map((d, i) => {
                                        const rate = d.total > 0 ? Math.round((d.funded / d.total) * 100) : 0
                                        return (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-5 py-3">
                                                    <p className="font-medium text-gray-800">{d.department_name}</p>
                                                    <p className="text-xs text-gray-400">{d.code}</p>
                                                </td>
                                                <td className="text-right px-4 py-3 font-semibold text-gray-900">{d.total}</td>
                                                <td className="text-right px-4 py-3 text-green-600 font-semibold">{d.funded}</td>
                                                <td className="text-right px-5 py-3">
                                                    <span className={cn(
                                                        'text-xs font-bold px-2 py-0.5 rounded-full',
                                                        rate >= 50 ? 'bg-green-100 text-green-700' :
                                                        rate >= 25 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-gray-100 text-gray-500'
                                                    )}>
                                                        {rate}%
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile: stacked cards */}
                        <div className="sm:hidden divide-y divide-gray-50">
                            {(stats?.by_department ?? []).map((d, i) => {
                                const rate = d.total > 0 ? Math.round((d.funded / d.total) * 100) : 0
                                return (
                                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-800 text-sm truncate">{d.department_name}</p>
                                            <p className="text-xs text-gray-400">{d.code}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 text-sm">
                                            <span className="text-gray-900 font-semibold">{d.total}</span>
                                            <span className="text-green-600 font-semibold">{d.funded}</span>
                                            <span className={cn(
                                                'text-xs font-bold px-2 py-0.5 rounded-full',
                                                rate >= 50 ? 'bg-green-100 text-green-700' :
                                                rate >= 25 ? 'bg-amber-100 text-amber-700' :
                                                'bg-gray-100 text-gray-500'
                                            )}>
                                                {rate}%
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
