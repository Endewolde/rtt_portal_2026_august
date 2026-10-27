import { useState, useEffect } from 'react'
import { Link } from '@inertiajs/react'
import {
    AlertTriangle, RefreshCw, Search, X, ArrowRight,
    ShieldAlert, Shield, ShieldCheck, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react'
import AppLayout from '../../Layouts/AppLayout'
import api from '../../lib/api'
import { getStatusLabel } from '../../lib/utils'

// ── Risk config ───────────────────────────────────────────────────────────────

function getRisk(score) {
    const pct = Math.round(score * 100)
    if (pct >= 80) return { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-300',    bar: 'bg-red-500',    icon: ShieldAlert }
    if (pct >= 70) return { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300', bar: 'bg-orange-400', icon: ShieldAlert }
    if (pct >= 50) return { label: 'Medium',   color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-300', bar: 'bg-yellow-400', icon: Shield     }
    return              { label: 'Low',        color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-300',  bar: 'bg-green-400',  icon: ShieldCheck }
}

function ScoreBar({ score }) {
    const pct  = Math.round(score * 100)
    const risk = getRisk(score)
    return (
        <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-bold tabular-nums ${risk.color}`}>{pct}%</span>
        </div>
    )
}

function RiskBadge({ score }) {
    const risk = getRisk(score)
    const Icon = risk.icon
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${risk.bg} ${risk.color} ${risk.border}`}>
            <Icon size={10} />
            {risk.label}
        </span>
    )
}

const STATUS_COLORS = {
    draft:               'bg-gray-100 text-gray-500',
    submitted:           'bg-blue-100 text-blue-700',
    validated:           'bg-indigo-100 text-indigo-700',
    under_blind_review:  'bg-yellow-100 text-yellow-700',
    blind_review_passed: 'bg-orange-100 text-orange-700',
    under_open_defence:  'bg-purple-100 text-purple-700',
    accepted:            'bg-green-100 text-green-700',
    funded:              'bg-emerald-100 text-emerald-700',
    rejected:            'bg-red-100 text-red-700',
    completed:           'bg-cyan-100 text-cyan-700',
}

const CATEGORY_LABELS = {
    research:             'Research',
    community_engagement: 'Community',
    technology_transfer:  'Technology',
    innovation:           'Innovation',
}

// ── Comparison modal ──────────────────────────────────────────────────────────

function CompareModal({ flag, onClose }) {
    if (!flag) return null
    const pct  = Math.round(flag.score * 100)
    const risk = getRisk(flag.score)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className={`px-6 py-4 flex items-center justify-between border-b ${flag.flagged ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`text-2xl font-bold tabular-nums ${risk.color}`}>{pct}%</div>
                        <div>
                            <div className="flex items-center gap-2">
                                <RiskBadge score={flag.score} />
                                {flag.flagged && (
                                    <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">⚠ Flagged</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Similarity score · checked {flag.checked_at ? new Date(flag.checked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Score bar */}
                <div className="px-6 py-3 bg-white border-b border-gray-100">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${risk.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>0%</span>
                        <span className="text-yellow-600">50% Medium</span>
                        <span className="text-orange-600">70% High</span>
                        <span className="text-red-600">80% Critical</span>
                        <span>100%</span>
                    </div>
                </div>

                {/* Side-by-side content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 divide-x divide-gray-200">
                        {/* Proposal A */}
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded">PROPOSAL</span>
                                <Link href={`/proposals/${flag.proposal_id}`}
                                    className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
                                    {flag.proposal?.tracker_number}
                                </Link>
                                {flag.proposal?.status && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-medium ${STATUS_COLORS[flag.proposal.status] || 'bg-gray-100 text-gray-500'}`}>
                                        {getStatusLabel(flag.proposal.status)}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-semibold text-gray-900 mb-1">{flag.proposal?.title}</p>
                            {flag.proposal?.category && (
                                <p className="text-xs text-indigo-600 font-medium mb-3">
                                    {CATEGORY_LABELS[flag.proposal.category] ?? flag.proposal.category}
                                </p>
                            )}
                            {flag.proposal?.abstract ? (
                                <p className="text-xs text-gray-600 leading-relaxed">{flag.proposal.abstract}</p>
                            ) : (
                                <p className="text-xs text-gray-300 italic">No abstract available</p>
                            )}
                        </div>

                        {/* Proposal B */}
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded">SIMILAR TO</span>
                                <Link href={`/proposals/${flag.similar_proposal_id}`}
                                    className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded hover:bg-purple-100">
                                    {flag.similar_proposal?.tracker_number}
                                </Link>
                                {flag.similar_proposal?.status && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-medium ${STATUS_COLORS[flag.similar_proposal.status] || 'bg-gray-100 text-gray-500'}`}>
                                        {getStatusLabel(flag.similar_proposal.status)}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-semibold text-gray-900 mb-1">{flag.similar_proposal?.title}</p>
                            <div className="mb-3 h-4" /> {/* spacer */}
                            {flag.similar_proposal?.abstract ? (
                                <p className="text-xs text-gray-600 leading-relaxed">{flag.similar_proposal.abstract}</p>
                            ) : (
                                <p className="text-xs text-gray-300 italic">No abstract available</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                        Similarity is calculated using TF-IDF cosine similarity on title, abstract, and keywords.
                    </p>
                    <div className="flex gap-2">
                        <Link href={`/proposals/${flag.proposal_id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                            View Proposal <ArrowRight size={11} />
                        </Link>
                        <Link href={`/proposals/${flag.similar_proposal_id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50">
                            View Similar <ArrowRight size={11} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SimilarityFlags() {
    const [flags,      setFlags]      = useState([])
    const [summary,    setSummary]    = useState(null)
    const [loading,    setLoading]    = useState(true)
    const [page,       setPage]       = useState(1)
    const [pagination, setPagination] = useState(null)
    const [selected,   setSelected]   = useState(null)

    const [filters, setFilters] = useState({
        flagged_only: false,
        min_score:    '',
        category:     '',
        search:       '',
    })

    const load = async (p = 1) => {
        setLoading(true)
        try {
            const params = { page: p }
            if (filters.flagged_only) params.flagged_only = 1
            if (filters.min_score)    params.min_score    = filters.min_score
            if (filters.category)     params.category     = filters.category

            const res     = await api.get('/similarity-scores', { params })
            const paged   = res.data?.data ?? {}
            const rawData = paged.data ?? paged ?? []

            setFlags(Array.isArray(rawData) ? rawData : [])
            setSummary(res.data?.summary ?? null)
            setPagination(paged.last_page ? paged : null)
        } catch {
            setFlags([])
        }
        setLoading(false)
    }

    useEffect(() => { setPage(1); load(1) }, [filters.flagged_only, filters.min_score, filters.category])
    useEffect(() => { load(page) }, [page])

    const visible = filters.search
        ? flags.filter(f =>
            f.proposal?.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
            f.proposal?.tracker_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
            f.similar_proposal?.tracker_number?.toLowerCase().includes(filters.search.toLowerCase())
        )
        : flags

    return (
        <AppLayout breadcrumb="Similarity Flags">
            <div className="max-w-7xl mx-auto p-6 space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                            <AlertTriangle size={18} className="text-orange-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Similarity Flags</h1>
                            <p className="text-xs text-gray-500 mt-0.5">AI-powered plagiarism detection using TF-IDF cosine similarity</p>
                        </div>
                    </div>
                    <button onClick={() => load(page)} disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {/* Summary cards */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Total Comparisons', value: summary.total,    color: 'text-gray-700', bg: 'bg-gray-50',   border: 'border-gray-200' },
                            { label: 'Flagged (≥70%)',    value: summary.flagged,  color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
                            { label: 'Critical (≥80%)',   value: summary.critical, color: 'text-red-700',  bg: 'bg-red-50',    border: 'border-red-200' },
                            { label: 'Average Score',     value: `${summary.avg_score}%`, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
                        ].map(s => (
                            <div key={s.label} className={`border ${s.border} ${s.bg} rounded-xl px-4 py-3`}>
                                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Risk legend */}
                <div className="flex flex-wrap gap-3 text-xs">
                    {[
                        { label: 'Low (<50%)',      bg: 'bg-green-100',  text: 'text-green-700'  },
                        { label: 'Medium (50–69%)', bg: 'bg-yellow-100', text: 'text-yellow-700' },
                        { label: 'High (70–79%)',   bg: 'bg-orange-100', text: 'text-orange-700' },
                        { label: 'Critical (≥80%)', bg: 'bg-red-100',    text: 'text-red-700'    },
                    ].map(r => (
                        <span key={r.label} className={`px-2 py-0.5 rounded-full font-medium ${r.bg} ${r.text}`}>{r.label}</span>
                    ))}
                    <span className="text-gray-400 self-center">Flagged = score ≥ threshold (default 70%)</span>
                </div>

                {/* Filters */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-48">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={filters.search}
                            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                            placeholder="Search tracker or title…"
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <select value={filters.min_score}
                        onChange={e => setFilters(f => ({ ...f, min_score: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="">All scores</option>
                        <option value="0.50">≥ 50% (Medium+)</option>
                        <option value="0.70">≥ 70% (High+)</option>
                        <option value="0.80">≥ 80% (Critical)</option>
                    </select>
                    <select value={filters.category}
                        onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="">All categories</option>
                        <option value="research">Research</option>
                        <option value="community_engagement">Community Engagement</option>
                        <option value="technology_transfer">Technology Transfer</option>
                        <option value="innovation">Innovation</option>
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={filters.flagged_only}
                            onChange={e => setFilters(f => ({ ...f, flagged_only: e.target.checked }))}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-400" />
                        <span className="text-sm text-gray-700">Flagged only</span>
                    </label>
                    <span className="text-sm text-gray-400 ml-auto">{visible.length} shown</span>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="bg-white border border-gray-200 rounded-xl">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 animate-pulse">
                                <div className="h-4 w-20 bg-gray-200 rounded" />
                                <div className="h-4 flex-1 bg-gray-100 rounded" />
                                <div className="h-4 w-24 bg-gray-100 rounded" />
                                <div className="h-4 w-16 bg-gray-200 rounded" />
                            </div>
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                        <AlertTriangle size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No similarity flags found</p>
                        <p className="text-sm text-gray-400 mt-1">Checks run automatically when proposals are submitted.</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                        {['Proposal', 'Title', 'Status', 'Similar To', 'Score', 'Risk', 'Checked', ''].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visible.map((f, rowIdx) => (
                                        <tr key={f.id}
                                            className={`hover:bg-orange-50/40 transition-colors cursor-pointer ${f.flagged ? 'bg-red-50/20' : ''}`}
                                            onClick={() => setSelected(f)}><td className="px-4 py-3 w-10 text-xs font-medium tabular-nums text-gray-400">{rowIdx + 1}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                    {f.proposal?.tracker_number ?? '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 max-w-xs">
                                                <p className="text-sm text-gray-900 line-clamp-1">{f.proposal?.title ?? '—'}</p>
                                                <p className="text-xs text-gray-400">{f.proposal?.college?.name} · {CATEGORY_LABELS[f.proposal?.category] ?? f.proposal?.category}</p>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {f.proposal?.status && (
                                                    <span className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${STATUS_COLORS[f.proposal.status] || 'bg-gray-100 text-gray-500'}`}>
                                                        {getStatusLabel(f.proposal.status)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                                    {f.similar_proposal?.tracker_number ?? '—'}
                                                </span>
                                                <p className="text-xs text-gray-400 mt-0.5 max-w-32 truncate">{f.similar_proposal?.title}</p>
                                            </td>
                                            <td className="px-4 py-3"><ScoreBar score={f.score} /></td>
                                            <td className="px-4 py-3 whitespace-nowrap"><RiskBadge score={f.score} /></td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                {f.checked_at ? new Date(f.checked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <button onClick={e => { e.stopPropagation(); setSelected(f) }}
                                                    className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-100">
                                                    <Eye size={11} /> Compare
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile: stacked cards */}
                        <div className="sm:hidden divide-y divide-gray-100">
                            {visible.map(f => (
                                <div key={f.id}
                                    className={`p-4 active:bg-gray-50 ${f.flagged ? 'bg-red-50/20' : ''}`}
                                    onClick={() => setSelected(f)}>
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                            {f.proposal?.tracker_number ?? '—'}
                                        </span>
                                        <RiskBadge score={f.score} />
                                    </div>
                                    <p className="text-sm text-gray-900 line-clamp-2 mb-1">{f.proposal?.title ?? '—'}</p>
                                    <p className="text-xs text-gray-400 mb-2">{f.proposal?.college?.name} · {CATEGORY_LABELS[f.proposal?.category] ?? f.proposal?.category}</p>
                                    <div className="mb-2"><ScoreBar score={f.score} /></div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                                {f.similar_proposal?.tracker_number ?? '—'}
                                            </span>
                                            <p className="text-[11px] text-gray-400 mt-0.5 max-w-40 truncate">{f.similar_proposal?.title}</p>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); setSelected(f) }}
                                            className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-100 shrink-0">
                                            <Eye size={11} /> Compare
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {pagination && pagination.last_page > 1 && (
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    Page {pagination.current_page} of {pagination.last_page} · {pagination.total} total
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={pagination.current_page <= 1}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
                                        <ChevronLeft size={12} /> Prev
                                    </button>
                                    <button onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                                        disabled={pagination.current_page >= pagination.last_page}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
                                        Next <ChevronRight size={12} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <CompareModal flag={selected} onClose={() => setSelected(null)} />
        </AppLayout>
    )
}
