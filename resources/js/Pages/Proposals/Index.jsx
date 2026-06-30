import { useState, useEffect } from 'react'
import { Link, usePage } from '@inertiajs/react'
import AppLayout from '../../Layouts/AppLayout'
import { useToast } from '../../Components/Toast'
import ViewToggle from '../../Components/ViewToggle'
import ProposalTable from '../../Components/ProposalTable'
import { useViewPreference } from '../../hooks/useViewPreference'
import { useAuth } from '../../hooks/useAuth'
import { BarChart2, Users, Building, GraduationCap, TrendingUp, Download, FileText, ArrowRight } from 'lucide-react'
import api from '../../lib/api'

// ── Kanban board ──────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
    { key: 'submitted',           label: 'Submitted',        color: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700'    },
    { key: 'validated',           label: 'Validated',        color: 'bg-indigo-500',  light: 'bg-indigo-50',  text: 'text-indigo-700'  },
    { key: 'under_blind_review',  label: 'Blind Review',     color: 'bg-yellow-500',  light: 'bg-yellow-50',  text: 'text-yellow-700'  },
    { key: 'blind_review_passed', label: 'Review Passed',    color: 'bg-orange-500',  light: 'bg-orange-50',  text: 'text-orange-700'  },
    { key: 'under_open_defence',  label: 'Open Defence',     color: 'bg-purple-500',  light: 'bg-purple-50',  text: 'text-purple-700'  },
    { key: 'accepted',            label: 'Accepted',         color: 'bg-green-500',   light: 'bg-green-50',   text: 'text-green-700'   },
    { key: 'funded',              label: 'Funded',           color: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700' },
    { key: 'completed',           label: 'Completed',        color: 'bg-cyan-600',    light: 'bg-cyan-50',    text: 'text-cyan-700'    },
    { key: 'rejected',            label: 'Rejected',         color: 'bg-red-500',     light: 'bg-red-50',     text: 'text-red-700'     },
]

function KanbanBoard({ proposals, loading }) {
    if (loading) {
        return (
            <div className="flex gap-4 overflow-x-auto pb-4">
                {KANBAN_COLUMNS.slice(0, 5).map(col => (
                    <div key={col.key} className="shrink-0 w-64 bg-gray-50 rounded-xl p-3 animate-pulse">
                        <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
                        {[1, 2].map(i => <div key={i} className="h-20 bg-white rounded-lg mb-2 border border-gray-100" />)}
                    </div>
                ))}
            </div>
        )
    }

    const grouped = KANBAN_COLUMNS.reduce((acc, col) => {
        acc[col.key] = proposals.filter(p => p.status === col.key)
        return acc
    }, {})

    const activeColumns = KANBAN_COLUMNS.filter(col => grouped[col.key]?.length > 0)
    const displayCols = activeColumns.length > 0 ? activeColumns : KANBAN_COLUMNS.slice(0, 5)

    return (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-1 px-1">
            {displayCols.map(col => {
                const cards = grouped[col.key] ?? []
                return (
                    <div key={col.key} className="shrink-0 w-64 flex flex-col">
                        <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${col.light}`}>
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${col.color}`} />
                                <span className={`text-xs font-bold ${col.text}`}>{col.label}</span>
                            </div>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${col.color} text-white`}>
                                {cards.length}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2 min-h-32">
                            {cards.length === 0 ? (
                                <div className="flex items-center justify-center h-20 border-2 border-dashed border-gray-200 rounded-xl">
                                    <p className="text-xs text-gray-300">Empty</p>
                                </div>
                            ) : cards.map(p => (
                                <Link key={p.id} href={`/proposals/${p.id}`}
                                    className="block bg-white border border-gray-200 rounded-xl p-3 hover:border-indigo-300 hover:shadow-sm transition-all group">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                                            {p.tracker_number}
                                        </span>
                                        <ArrowRight size={11} className="text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                                    </div>
                                    <p className="text-xs font-semibold text-gray-800 line-clamp-2 mb-2">{p.title}</p>
                                    {p.pi && <p className="text-[10px] text-gray-400 truncate">PI: {p.pi.name}</p>}
                                    {p.college && <p className="text-[10px] text-gray-400 truncate">{p.college.name}</p>}
                                </Link>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

const COLLEGE_COLORS = [
    { bg: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
    { bg: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
    { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    { bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    { bg: 'bg-teal-500',   light: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200'   },
]

const GENDER_CONFIG = {
    male:          { icon: '👨', label: 'Male',          color: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700'   },
    female:        { icon: '👩', label: 'Female',        color: 'bg-pink-500',   light: 'bg-pink-50',   text: 'text-pink-700'   },
    other:         { icon: '🧑', label: 'Other',         color: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700' },
    not_specified: { icon: '❓', label: 'Not Specified', color: 'bg-gray-400',   light: 'bg-gray-50',   text: 'text-gray-600'   },
}

const STATUS_COLORS = {
    submitted:           'bg-blue-500',
    validated:           'bg-indigo-500',
    under_blind_review:  'bg-yellow-500',
    blind_review_passed: 'bg-orange-500',
    under_open_defence:  'bg-purple-500',
    accepted:            'bg-green-500',
    funded:              'bg-emerald-600',
    midterm_evaluation:  'bg-teal-500',
    completed:           'bg-cyan-500',
    rejected:            'bg-red-500',
    archived:            'bg-slate-500',
}

const CATEGORY_CONFIG = {
    research:             { icon: '🔬', color: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700'   },
    community_engagement: { icon: '🤝', color: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-700'  },
    technology_transfer:  { icon: '🚀', color: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700' },
    innovation:           { icon: '💡', color: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700' },
    other:                { icon: '📋', color: 'bg-gray-500',   light: 'bg-gray-50',   text: 'text-gray-700'   },
}

export default function ProposalIndex() {
    const { app_settings } = usePage().props
    // current_academic_year is already shared via HandleInertiaRequests — no extra API call needed
    const currentAcademicYear = app_settings?.current_academic_year || ''

    const { error } = useToast()
    const { hasAnyRole, user } = useAuth()
    const isAdmin = hasAnyRole([
        'super_admin', 'admin', 'central_officer',
        'research_officer', 'community_officer', 'technology_officer',
        'college_officer',
    ])

    const [view, setView] = useViewPreference('proposals_index', 'table')
    const [stats, setStats] = useState(null)
    const [proposals, setProposals] = useState([])
    const [loading, setLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)
    const [filters, setFilters] = useState({
        status: '', category: '', college_id: '', academic_year: currentAcademicYear, search: '',
    })
    const [colleges, setColleges] = useState([])
    const [academicYears, setAcademicYears] = useState(currentAcademicYear ? [currentAcademicYear] : [])
    const [showStats, setShowStats] = useState(true)
    const [activeStatTab, setActiveStatTab] = useState('college')
    const [exporting, setExporting]       = useState(false)
    const [pdfExporting, setPdfExporting] = useState(false)

    useEffect(() => {
        if (user && !isAdmin) { window.location.href = '/my-proposals' }
    }, [user, isAdmin])

    // Load college list once
    useEffect(() => {
        api.get('/colleges').then(res => setColleges(res.data?.data || [])).catch(() => {})
    }, [])

    // Reload stats whenever the academic year filter changes
    useEffect(() => {
        loadStats(filters.academic_year)
    }, [filters.academic_year])

    // Reload proposals on any filter change
    useEffect(() => {
        loadProposals()
    }, [filters])

    const loadStats = async (academicYear) => {
        setStatsLoading(true)
        try {
            const params = academicYear ? { academic_year: academicYear } : {}
            const res = await api.get('/proposals/statistics', { params })
            const data = res.data?.data || null
            setStats(data)
            if (data?.available_years?.length) {
                setAcademicYears(data.available_years)
            }
        } catch (_) {}
        setStatsLoading(false)
    }

    const loadProposals = async () => {
        setLoading(true)
        try {
            const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
            const res = await api.get('/proposals', { params })
            const data = res.data?.data || []
            setProposals(Array.isArray(data) ? data : data?.data || [])
        } catch (_) {
            error('Failed to load proposals.')
        }
        setLoading(false)
    }

    const maxCollegeTotal = Math.max(1, ...(stats?.by_college || []).map(c => c.total))

    const handleExport = async () => {
        setExporting(true)
        try {
            const params = new URLSearchParams(
                Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
            )
            const token = localStorage.getItem('rtt_token')
            const res   = await fetch(`/api/v1/reports/proposals/export?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) { error('Export failed. Please try again.'); return }
            const blob = await res.blob()
            const url  = URL.createObjectURL(blob)
            const a    = document.createElement('a')
            a.href     = url
            a.download = `proposals_${new Date().toISOString().slice(0, 10)}.xlsx`
            a.click()
            URL.revokeObjectURL(url)
        } catch (_) {
            error('Export failed. Please try again.')
        } finally {
            setExporting(false)
        }
    }

    const handlePdfExport = async () => {
        setPdfExporting(true)
        try {
            const params = new URLSearchParams(
                Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
            )
            const token = localStorage.getItem('rtt_token')
            const res   = await fetch(`/api/v1/reports/proposals/stats-pdf?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) { error('PDF generation failed. Please try again.'); return }
            const blob = await res.blob()
            const url  = URL.createObjectURL(blob)
            const a    = document.createElement('a')
            a.href     = url
            a.download = `Proposal-Statistics-${new Date().toISOString().slice(0, 10)}.pdf`
            a.click()
            URL.revokeObjectURL(url)
        } catch (_) {
            error('PDF generation failed. Please try again.')
        } finally {
            setPdfExporting(false)
        }
    }

    if (!isAdmin && user) return null

    return (
        <AppLayout breadcrumb="All Proposals">
            <div className="p-6 max-w-7xl mx-auto space-y-6">

                {/* Page header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">All Proposals</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {stats?.totals?.submitted || 0} submitted proposals
                            {filters.academic_year && <span className="ml-1 text-indigo-500 font-medium">· {filters.academic_year}</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                            <BarChart2 size={14} />
                            {showStats ? 'Hide' : 'Show'} Stats
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Download size={14} /> {exporting ? 'Exporting…' : 'Export Excel'}
                        </button>
                        <button
                            onClick={handlePdfExport}
                            disabled={pdfExporting}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                        >
                            <FileText size={14} />
                            {pdfExporting ? 'Generating…' : 'PDF Report'}
                        </button>
                        <ViewToggle view={view} onChange={setView} />
                    </div>
                </div>

                {/* STATISTICS SECTION */}
                {showStats && (
                    <div className="space-y-4">

                        {/* Overall totals */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {[
                                { label: 'Total Submitted', value: stats?.totals?.submitted || 0,                                           icon: '📄', color: 'blue'   },
                                { label: 'Under Review',    value: stats?.totals?.under_review || 0,                                        icon: '🔍', color: 'purple' },
                                { label: 'Funded',          value: stats?.totals?.funded || 0,                                              icon: '🏆', color: 'green'  },
                                { label: 'Rejected',        value: stats?.totals?.rejected || 0,                                            icon: '❌', color: 'red'    },
                                { label: 'Draft',           value: stats?.totals?.draft || 0,                                               icon: '✏️', color: 'gray'   },
                            ].map(stat => (
                                <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                                    <div className="text-2xl mb-1">{stat.icon}</div>
                                    <div className={`text-2xl font-bold text-${stat.color}-600`}>{statsLoading ? '—' : stat.value}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Stat tabs */}
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                            <div className="flex border-b border-gray-200 overflow-x-auto">
                                {[
                                    { key: 'college',    label: '🏛 By College'    },
                                    { key: 'department', label: '📚 By Department' },
                                    { key: 'gender',     label: '👥 By Gender'     },
                                    { key: 'status',     label: '📊 By Status'     },
                                    { key: 'category',   label: '🏷 By Category'   },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveStatTab(tab.key)}
                                        className={`shrink-0 flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                            activeStatTab === tab.key
                                                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="p-5">

                                {/* BY COLLEGE */}
                                {activeStatTab === 'college' && (
                                    <div className="space-y-3">
                                        {statsLoading ? (
                                            <div className="animate-pulse space-y-3">
                                                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
                                            </div>
                                        ) : (stats?.by_college || []).length === 0 ? (
                                            <p className="text-gray-400 text-sm text-center py-4">No data for this year.</p>
                                        ) : (stats?.by_college || []).map((college, i) => {
                                            const colorSet  = COLLEGE_COLORS[i % COLLEGE_COLORS.length]
                                            const pct       = Math.round((college.total / maxCollegeTotal) * 100)
                                            const fundedPct = college.total > 0 ? Math.round((college.funded / college.total) * 100) : 0
                                            return (
                                                <div key={college.id} className={`border ${colorSet.border} ${colorSet.light} rounded-xl p-4`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 ${colorSet.bg} rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                                                {college.code}
                                                            </div>
                                                            <div>
                                                                <p className={`text-sm font-semibold ${colorSet.text}`}>{college.college_name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {college.funded} funded · {college.rejected} rejected · {college.active} active
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={`text-2xl font-bold ${colorSet.text}`}>{college.total}</span>
                                                            <p className="text-xs text-gray-400">proposals</p>
                                                        </div>
                                                    </div>
                                                    <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                                                        <div className={`h-full ${colorSet.bg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <div className="flex gap-4 mt-2 text-xs">
                                                        <span className="text-green-600">✓ {fundedPct}% funded</span>
                                                        <span className="text-gray-400">{college.total - college.funded - college.rejected} in progress</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* BY DEPARTMENT */}
                                {activeStatTab === 'department' && (
                                    <div>
                                        <p className="text-xs text-gray-400 mb-3">Top 10 departments by submissions</p>
                                        <div className="space-y-2">
                                            {statsLoading ? (
                                                <div className="animate-pulse space-y-2">
                                                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
                                                </div>
                                            ) : (stats?.by_department || []).length === 0 ? (
                                                <p className="text-gray-400 text-sm text-center py-4">No data for this year.</p>
                                            ) : (() => {
                                                const maxDeptTotal = Math.max(1, ...(stats?.by_department || []).map(d => d.total))
                                                return (stats?.by_department || []).map((dept, i) => (
                                                    <div key={dept.id} className="flex items-center gap-3">
                                                        <span className="w-6 text-xs text-gray-400 text-right shrink-0">{i + 1}</span>
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div>
                                                                    <span className="text-sm font-medium text-gray-900">{dept.department_name}</span>
                                                                    <span className="text-xs text-gray-400 ml-2">{dept.college_name}</span>
                                                                </div>
                                                                <div className="text-right shrink-0 ml-4">
                                                                    <span className="text-sm font-bold text-gray-700">{dept.total}</span>
                                                                    {dept.funded > 0 && (
                                                                        <span className="text-xs text-green-600 ml-1">({dept.funded} funded)</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(dept.total / maxDeptTotal) * 100}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* BY GENDER */}
                                {activeStatTab === 'gender' && (
                                    <div>
                                        {statsLoading ? (
                                            <div className="animate-pulse grid grid-cols-2 gap-4">
                                                {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
                                            </div>
                                        ) : (stats?.by_gender || []).length === 0 ? (
                                            <p className="text-gray-400 text-sm text-center py-4">No data for this year.</p>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                {(stats?.by_gender || []).map(g => {
                                                    const config      = GENDER_CONFIG[g.gender] || GENDER_CONFIG.not_specified
                                                    const totalGender = (stats?.by_gender || []).reduce((s, x) => s + Number(x.total), 0)
                                                    const pct         = totalGender > 0 ? Math.round((g.total / totalGender) * 100) : 0
                                                    const fundedPct   = g.total > 0 ? Math.round((g.funded / g.total) * 100) : 0
                                                    return (
                                                        <div key={g.gender} className={`${config.light} border border-gray-200 rounded-2xl p-5 text-center`}>
                                                            <div className="text-3xl mb-2">{config.icon}</div>
                                                            <p className={`text-sm font-semibold ${config.text} mb-1`}>{config.label}</p>
                                                            <p className={`text-3xl font-bold ${config.text}`}>{g.total}</p>
                                                            <p className="text-xs text-gray-400 mt-1">{pct}% of total</p>
                                                            <div className="mt-3 h-1.5 bg-white rounded-full overflow-hidden">
                                                                <div className={`h-full ${config.color} rounded-full`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                            {g.funded > 0 && (
                                                                <p className="text-xs text-green-600 mt-2 font-medium">🏆 {fundedPct}% funded</p>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        {(stats?.by_gender || []).length > 0 && (() => {
                                            const male      = stats.by_gender.find(g => g.gender === 'male')?.total || 0
                                            const female    = stats.by_gender.find(g => g.gender === 'female')?.total || 0
                                            const total     = Number(male) + Number(female)
                                            const femalePct = total > 0 ? Math.round((female / total) * 100) : 0
                                            return (
                                                <div className={`mt-4 p-4 rounded-xl border text-sm ${
                                                    femalePct >= 40
                                                        ? 'bg-green-50 border-green-200 text-green-700'
                                                        : femalePct >= 30
                                                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                                                        : 'bg-red-50 border-red-200 text-red-700'
                                                }`}>
                                                    <strong>Gender equity:</strong> Female researchers represent <strong>{femalePct}%</strong> of proposals.
                                                    {femalePct >= 40 ? ' ✓ Good gender balance.' : femalePct >= 30 ? ' Consider encouraging more female applicants.' : ' Significant gender gap — action recommended.'}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )}

                                {/* BY STATUS */}
                                {activeStatTab === 'status' && (
                                    <div className="space-y-2">
                                        {statsLoading ? (
                                            <div className="animate-pulse space-y-2">
                                                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
                                            </div>
                                        ) : Object.entries(stats?.by_status || {}).length === 0 ? (
                                            <p className="text-gray-400 text-sm text-center py-4">No data for this year.</p>
                                        ) : Object.entries(stats?.by_status || {})
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([status, count]) => {
                                                const total = Object.values(stats?.by_status || {}).reduce((s, v) => s + Number(v), 0)
                                                const pct   = total > 0 ? Math.round((count / total) * 100) : 0
                                                const color = STATUS_COLORS[status] || 'bg-gray-400'
                                                return (
                                                    <div key={status} className="flex items-center gap-3">
                                                        <div className={`w-3 h-3 rounded-full ${color} shrink-0`} />
                                                        <div className="flex-1">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-sm text-gray-700 capitalize">{status.replace(/_/g, ' ')}</span>
                                                                <span className="text-sm font-semibold text-gray-900">
                                                                    {count}
                                                                    <span className="text-xs text-gray-400 ml-1">({pct}%)</span>
                                                                </span>
                                                            </div>
                                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        }
                                    </div>
                                )}

                                {/* BY CATEGORY */}
                                {activeStatTab === 'category' && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {statsLoading ? (
                                            <div className="animate-pulse col-span-3 grid grid-cols-3 gap-4">
                                                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
                                            </div>
                                        ) : Object.entries(stats?.by_category || {}).length === 0 ? (
                                            <p className="text-gray-400 text-sm text-center py-4 col-span-3">No data for this year.</p>
                                        ) : Object.entries(stats?.by_category || {}).map(([category, total]) => {
                                            const config = CATEGORY_CONFIG[category] || { icon: '📋', color: 'bg-gray-500', light: 'bg-gray-50', text: 'text-gray-700' }
                                            return (
                                                <div key={category} className={`${config.light} border border-gray-200 rounded-xl p-4 text-center`}>
                                                    <div className="text-3xl mb-2">{config.icon}</div>
                                                    <p className={`text-2xl font-bold ${config.text}`}>{total}</p>
                                                    <p className="text-xs text-gray-500 mt-1 capitalize">{category.replace(/_/g, ' ')}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* FILTERS */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                        <input
                            type="text"
                            placeholder="Search title or tracker..."
                            value={filters.search}
                            onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                            className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={filters.academic_year}
                            onChange={e => setFilters(p => ({ ...p, academic_year: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                            <option value="">All Years</option>
                            {academicYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <select
                            value={filters.status}
                            onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="submitted">Submitted</option>
                            <option value="validated">Validated</option>
                            <option value="under_blind_review">Blind Review</option>
                            <option value="blind_review_passed">Blind Review Passed</option>
                            <option value="under_open_defence">Open Defence</option>
                            <option value="accepted">Accepted</option>
                            <option value="funded">Funded</option>
                            <option value="rejected">Rejected</option>
                            <option value="completed">Completed</option>
                        </select>
                        <select
                            value={filters.category}
                            onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Categories</option>
                            <option value="research">Research</option>
                            <option value="community_engagement">Community Engagement</option>
                            <option value="technology_transfer">Technology Transfer</option>
                            <option value="innovation">Innovation</option>
                            <option value="other">Other</option>
                        </select>
                        <select
                            value={filters.college_id}
                            onChange={e => setFilters(p => ({ ...p, college_id: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Colleges</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* PROPOSALS LIST */}
                {view === 'table' ? (
                    <ProposalTable
                        proposals={proposals}
                        showColumns={['tracker', 'title', 'category', 'pi', 'college', 'status', 'date']}
                        loading={loading}
                        emptyMessage="No proposals found matching your filters."
                        actions={(proposal) => (
                            <Link
                                href={`/proposals/${proposal.id}`}
                                className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                            >
                                View
                            </Link>
                        )}
                    />
                ) : view === 'kanban' ? (
                    <KanbanBoard proposals={proposals} loading={loading} />
                ) : (
                    <div>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
                                        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                                        <div className="h-5 bg-gray-200 rounded w-full mb-2" />
                                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    </div>
                                ))}
                            </div>
                        ) : proposals.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                                <p className="text-4xl mb-3">📄</p>
                                <p className="text-gray-500 font-medium">No proposals found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {proposals.map(proposal => (
                                    <Link
                                        key={proposal.id}
                                        href={`/proposals/${proposal.id}`}
                                        className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-300 transition-all group block"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                {proposal.tracker_number}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                proposal.status === 'funded' || proposal.status === 'completed'
                                                    ? 'bg-green-100 text-green-700'
                                                    : proposal.status === 'rejected'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {proposal.status?.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-700 transition-colors">
                                            {proposal.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="capitalize">{proposal.category?.replace(/_/g, ' ')}</span>
                                            <span>·</span>
                                            <span>{proposal.college?.name}</span>
                                        </div>
                                        {proposal.pi && (
                                            <p className="text-xs text-gray-400 mt-1">PI: {proposal.pi.name}</p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
