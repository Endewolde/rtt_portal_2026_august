import { useState } from 'react'
import { router } from '@inertiajs/react'
import {
    ComposedChart, BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Cell, PieChart, Pie, ReferenceLine,
} from 'recharts'
import {
    BarChart2, TrendingUp, Users, Activity, Building2,
    FlaskConical, Brain, BookOpen, Filter, RefreshCw,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'

const PIE_COLORS = [
    '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
    '#ec4899', '#a855f7', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
]

const CHART_STYLE = {
    contentStyle: {
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        fontSize: 12,
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
    },
    labelStyle: { fontWeight: 600, color: '#111827', marginBottom: 4 },
}

const Skeleton = ({ height = 280 }) => (
    <div className="animate-pulse rounded-xl bg-gray-100" style={{ height }} />
)

const Empty = () => (
    <div className="flex items-center justify-center text-sm text-gray-300" style={{ height: 200 }}>
        No data available
    </div>
)

function ChartCard({ title, icon: Icon, desc, bg, color, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-gray-50 flex items-center gap-3">
                <span className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon size={15} className={color} />
                </span>
                <div>
                    <p className="text-sm font-semibold text-gray-900">{title}</p>
                    {desc && <p className="text-xs text-gray-400">{desc}</p>}
                </div>
            </div>
            <div className="p-5">{children}</div>
        </div>
    )
}

export default function Analytics({
    filters,
    academicYears,
    colleges,
    summaryStats,
    researchTypes,
    collegePerf,
    passRateTrends,
    appTrends,
    genderPassRate,
    yearDistribution,
    collegeTypeDist,
    predictive,
}) {
    const [yr, setYr] = useState(filters?.academic_year ?? '')
    const [col, setCol] = useState(filters?.college_id ?? '')

    function applyFilters() {
        router.get('/admin/analytics', {
            ...(yr ? { academic_year: yr } : {}),
            ...(col ? { college_id: col } : {}),
        })
    }

    function resetFilters() {
        setYr('')
        setCol('')
        router.get('/admin/analytics')
    }

    const stats = summaryStats ?? {}

    return (
        <AppLayout title="Analytics Dashboard">

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                    Research proposal analytics and predictive insights
                </p>
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Academic Year</label>
                    <select
                        value={yr}
                        onChange={e => setYr(e.target.value)}
                        className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:border-indigo-400 min-w-36"
                    >
                        <option value="">All Years</option>
                        {(academicYears ?? []).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">College</label>
                    <select
                        value={col}
                        onChange={e => setCol(e.target.value)}
                        className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:border-indigo-400 min-w-52"
                    >
                        <option value="">All Colleges</option>
                        {(colleges ?? []).map(c => (
                            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={applyFilters}
                    className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                >
                    <Filter size={13} /> Apply
                </button>
                <button
                    onClick={resetFilters}
                    className="h-9 px-4 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                    <RefreshCw size={13} /> Reset
                </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-5">
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total Proposals</p>
                    <p className="text-3xl font-bold text-indigo-700 mt-1">{stats.total ?? '–'}</p>
                    <p className="text-xs text-gray-400 mt-1">Across all years</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 p-5">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Funded</p>
                    <p className="text-3xl font-bold text-emerald-700 mt-1">{stats.funded ?? '–'}</p>
                    <p className="text-xs text-gray-400 mt-1">Accepted or completed</p>
                </div>
                <div className="bg-gradient-to-br from-rose-50 to-white rounded-2xl border border-rose-100 p-5">
                    <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Rejected</p>
                    <p className="text-3xl font-bold text-rose-700 mt-1">{stats.rejected ?? '–'}</p>
                    <p className="text-xs text-gray-400 mt-1">Did not proceed</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 p-5">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pass Rate</p>
                    <p className="text-3xl font-bold text-amber-700 mt-1">
                        {stats.pass_rate != null ? `${stats.pass_rate}%` : '–'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Funded / submitted</p>
                </div>
            </div>

            <div className="space-y-6">

                {/* Row 1: Research Type + College Type Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* 1. Research Type Distribution */}
                    <ChartCard
                        title="Research Type Distribution"
                        icon={FlaskConical}
                        desc="Proposal volume by research type"
                        bg="bg-indigo-50"
                        color="text-indigo-600"
                    >
                        {!researchTypes
                            ? <Skeleton />
                            : researchTypes.length === 0
                                ? <Empty />
                                : (
                                    <div className="flex items-center gap-4">
                                        <div className="shrink-0" style={{ width: 200, height: 200 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={researchTypes}
                                                        dataKey="count"
                                                        nameKey="research_type"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={52}
                                                        outerRadius={80}
                                                        paddingAngle={2}
                                                    >
                                                        {researchTypes.map((_, i) => (
                                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip {...CHART_STYLE} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex-1 space-y-2 min-w-0">
                                            {researchTypes.map((r, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                                                    />
                                                    <span className="text-xs text-gray-600 flex-1 truncate">{r.research_type}</span>
                                                    <span className="text-xs font-semibold text-gray-900 shrink-0">{r.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                        }
                    </ChartCard>

                    {/* 8. College Type Distribution */}
                    <ChartCard
                        title="College Type Distribution"
                        icon={Building2}
                        desc="Proposal volume and funding per college"
                        bg="bg-blue-50"
                        color="text-blue-600"
                    >
                        {!collegeTypeDist
                            ? <Skeleton />
                            : collegeTypeDist.length === 0
                                ? <Empty />
                                : (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <BarChart
                                            data={collegeTypeDist.slice(0, 8)}
                                            layout="vertical"
                                            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <YAxis
                                                type="category"
                                                dataKey="code"
                                                tick={{ fontSize: 11 }}
                                                width={56}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip {...CHART_STYLE} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Bar dataKey="count" name="Total" radius={[0, 4, 4, 0]} fill="#3b82f6">
                                                {collegeTypeDist.slice(0, 8).map((_, i) => (
                                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                ))}
                                            </Bar>
                                            <Bar dataKey="funded" name="Funded" radius={[0, 4, 4, 0]} fill="#10b981" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )
                        }
                    </ChartCard>
                </div>

                {/* 2. College Performance Details */}
                <ChartCard
                    title="College Performance Details"
                    icon={BarChart2}
                    desc="Submission volume and pass rate per college"
                    bg="bg-purple-50"
                    color="text-purple-600"
                >
                    {!collegePerf
                        ? <Skeleton height={360} />
                        : (
                            <>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart
                                        data={collegePerf.filter(c => c.total > 0)}
                                        margin={{ top: 4, right: 16, left: 0, bottom: 48 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="code"
                                            tick={{ fontSize: 11 }}
                                            angle={-30}
                                            textAnchor="end"
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                        <Tooltip {...CHART_STYLE} />
                                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                        <Bar dataKey="total" name="Total" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="funded" name="Funded" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="rejected" name="Rejected" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="py-2.5 px-4 text-gray-400 font-semibold w-10">#</th>
                                                <th className="text-left py-2.5 px-4 text-gray-500 font-semibold">College</th>
                                                <th className="text-right py-2.5 px-4 text-gray-500 font-semibold">Total</th>
                                                <th className="text-right py-2.5 px-4 text-emerald-600 font-semibold">Funded</th>
                                                <th className="text-right py-2.5 px-4 text-rose-500 font-semibold">Rejected</th>
                                                <th className="text-right py-2.5 px-4 text-gray-500 font-semibold">Pass Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {collegePerf.map((c, i) => (
                                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                    <td className="py-2.5 px-4 text-xs font-medium text-gray-400 tabular-nums">{i + 1}</td>
                                                    <td className="py-2.5 px-4 text-gray-700 font-medium">{c.college}</td>
                                                    <td className="py-2.5 px-4 text-right text-gray-600">{c.total}</td>
                                                    <td className="py-2.5 px-4 text-right text-emerald-600 font-semibold">{c.funded}</td>
                                                    <td className="py-2.5 px-4 text-right text-rose-500">{c.rejected}</td>
                                                    <td className="py-2.5 px-4 text-right">
                                                        <span className={`font-semibold ${c.pass_rate >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            {c.pass_rate != null ? `${c.pass_rate}%` : '–'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )
                    }
                </ChartCard>

                {/* Row 3: Pass Rate Trends + Application Trends */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* 3. Pass Rate Trends Over Academic Year */}
                    <ChartCard
                        title="Pass Rate Trends Over Academic Year"
                        icon={TrendingUp}
                        desc="Funding success rate trend per academic year"
                        bg="bg-emerald-50"
                        color="text-emerald-600"
                    >
                        {!passRateTrends
                            ? <Skeleton />
                            : passRateTrends.length === 0
                                ? <Empty />
                                : (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <LineChart data={passRateTrends} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="academic_year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                                            <Tooltip {...CHART_STYLE} formatter={v => [`${v}%`, 'Pass Rate']} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Line
                                                type="monotone"
                                                dataKey="pass_rate"
                                                name="Pass Rate %"
                                                stroke="#10b981"
                                                strokeWidth={2.5}
                                                dot={{ r: 4, fill: '#10b981' }}
                                                activeDot={{ r: 6 }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="total"
                                                name="Total Proposals"
                                                stroke="#6366f1"
                                                strokeWidth={1.5}
                                                strokeDasharray="4 2"
                                                dot={{ r: 3, fill: '#6366f1' }}
                                                yAxisId={0}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )
                        }
                    </ChartCard>

                    {/* 5. Proposal Application Trends */}
                    <ChartCard
                        title="Proposal Application Trends"
                        icon={Activity}
                        desc="Monthly submission volume over the last 24 months"
                        bg="bg-cyan-50"
                        color="text-cyan-600"
                    >
                        {!appTrends
                            ? <Skeleton />
                            : appTrends.length === 0
                                ? <Empty />
                                : (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <AreaChart data={appTrends} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="gSubmitted" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gFunded" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <Tooltip {...CHART_STYLE} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Area
                                                type="monotone"
                                                dataKey="submitted"
                                                name="Submitted"
                                                stroke="#06b6d4"
                                                fill="url(#gSubmitted)"
                                                strokeWidth={2}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="funded"
                                                name="Funded"
                                                stroke="#10b981"
                                                fill="url(#gFunded)"
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )
                        }
                    </ChartCard>
                </div>

                {/* Row 4: Gender + Year Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* 6. Pass Rate by Gender */}
                    <ChartCard
                        title="Pass Rate by Gender"
                        icon={Users}
                        desc="Funding success rate by principal investigator gender"
                        bg="bg-pink-50"
                        color="text-pink-600"
                    >
                        {!genderPassRate
                            ? <Skeleton />
                            : genderPassRate.length === 0
                                ? <Empty />
                                : (
                                    <div className="space-y-5">
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart data={genderPassRate} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="gender"
                                                    tick={{ fontSize: 12 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={g => g ? g.charAt(0).toUpperCase() + g.slice(1) : '–'}
                                                />
                                                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                                <Tooltip {...CHART_STYLE} />
                                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                                <Bar dataKey="total" name="Total" fill="#e879f9" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="funded" name="Funded" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="rejected" name="Rejected" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                        <div className="grid grid-cols-2 gap-2">
                                            {genderPassRate.map((g, i) => (
                                                <div key={i} className="bg-gray-50 rounded-xl p-3">
                                                    <p className="text-xs text-gray-500 capitalize font-medium">{g.gender}</p>
                                                    <p className="text-2xl font-bold text-gray-900 mt-0.5">
                                                        {g.pass_rate != null ? `${g.pass_rate}%` : '–'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">{g.funded} of {g.total} funded</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                        }
                    </ChartCard>

                    {/* 7. Pass Rate Distribution by Academic Year */}
                    <ChartCard
                        title="Pass Rate Distribution by Academic Year"
                        icon={BookOpen}
                        desc="Funded, in-progress and rejected proposals per year"
                        bg="bg-amber-50"
                        color="text-amber-600"
                    >
                        {!yearDistribution
                            ? <Skeleton />
                            : yearDistribution.length === 0
                                ? <Empty />
                                : (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={yearDistribution} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="academic_year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <Tooltip {...CHART_STYLE} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Bar dataKey="funded" name="Funded" stackId="a" fill="#10b981" />
                                            <Bar dataKey="in_progress" name="In Progress" stackId="a" fill="#3b82f6" />
                                            <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )
                        }
                    </ChartCard>
                </div>

                {/* 9. Predictive Analysis Model */}
                <ChartCard
                    title="Predictive Analysis Model"
                    icon={Brain}
                    desc="Linear regression trend forecast for proposal applications"
                    bg="bg-violet-50"
                    color="text-violet-600"
                >
                    {!predictive
                        ? <Skeleton height={380} />
                        : (() => {
                            const allData = [
                                ...predictive.historical.map(h => ({
                                    year: h.year,
                                    actual: h.actual,
                                    trend: h.trend,
                                })),
                                ...predictive.predictions.map(p => ({
                                    year: p.year,
                                    predicted: p.predicted,
                                    trend: p.trend,
                                })),
                            ]
                            const splitYear = predictive.historical[predictive.historical.length - 1]?.year

                            return (
                                <div className="space-y-4">
                                    {allData.length === 0
                                        ? <Empty />
                                        : (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <ComposedChart data={allData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                                    <Tooltip {...CHART_STYLE} />
                                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                                    {splitYear && (
                                                        <ReferenceLine
                                                            x={splitYear}
                                                            stroke="#d1d5db"
                                                            strokeDasharray="4 2"
                                                            label={{ value: 'Now', position: 'insideTopRight', fontSize: 11, fill: '#9ca3af' }}
                                                        />
                                                    )}
                                                    <Bar dataKey="actual" name="Historical" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="predicted" name="Predicted" fill="#a855f7" radius={[4, 4, 0, 0]} opacity={0.65} />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="trend"
                                                        name="Trend Line"
                                                        stroke="#f59e0b"
                                                        strokeWidth={2.5}
                                                        strokeDasharray="5 3"
                                                        dot={false}
                                                    />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        )
                                    }

                                    {predictive.equation && (
                                        <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-50">
                                            <div className="bg-violet-50 rounded-xl px-3 py-2.5 text-xs">
                                                <span className="text-violet-500 font-medium">Slope: </span>
                                                <span className="text-violet-900 font-bold">
                                                    {predictive.equation.slope > 0 ? '+' : ''}
                                                    {predictive.equation.slope} proposals/yr
                                                </span>
                                            </div>
                                            {predictive.r_squared != null && (
                                                <div className="bg-amber-50 rounded-xl px-3 py-2.5 text-xs">
                                                    <span className="text-amber-500 font-medium">R² fit quality: </span>
                                                    <span className="text-amber-900 font-bold">{predictive.r_squared}</span>
                                                </div>
                                            )}
                                            {predictive.predictions.map((p, i) => (
                                                <div key={i} className="bg-purple-50 rounded-xl px-3 py-2.5 text-xs">
                                                    <span className="text-purple-500 font-medium">{p.year}: </span>
                                                    <span className="text-purple-900 font-bold">~{p.predicted} proposals</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400">
                                        * Predictions are based on a simple linear regression model and should be used as estimates only.
                                    </p>
                                </div>
                            )
                        })()
                    }
                </ChartCard>

            </div>
        </AppLayout>
    )
}
