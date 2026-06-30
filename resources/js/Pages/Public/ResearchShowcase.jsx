import { useState, useEffect } from 'react'
import {
    Search, FlaskConical, Users, TrendingUp, Lightbulb, LayoutGrid,
    Building2, ChevronLeft, ChevronRight, X, ExternalLink,
    BookOpen, Globe, Award,
} from 'lucide-react'
import PublicLayout from '../../Layouts/PublicLayout'
import { get } from '../../lib/api'
import { cn } from '../../lib/utils'

const CATEGORIES = [
    { value: '',                    label: 'All Categories',  Icon: LayoutGrid,    color: '#6366f1' },
    { value: 'research',            label: 'Research',        Icon: FlaskConical,  color: '#3b82f6' },
    { value: 'community_engagement',label: 'Community',       Icon: Users,         color: '#10b981' },
    { value: 'technology_transfer', label: 'Tech Transfer',   Icon: TrendingUp,    color: '#8b5cf6' },
]

const CAT_MAP = {
    research:             { label: 'Research',      color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'   },
    community_engagement: { label: 'Community',     color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    technology_transfer:  { label: 'Tech Transfer', color: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-500'  },
}

const STATUS_LABEL = {
    funded:            { label: 'Funded',    cls: 'bg-green-100 text-green-700'  },
    midterm_evaluation:{ label: 'Ongoing',   cls: 'bg-amber-100 text-amber-700'  },
    completed:         { label: 'Completed', cls: 'bg-slate-100 text-slate-700'  },
}

function ProposalCard({ proposal }) {
    const cat = CAT_MAP[proposal.category] ?? { label: proposal.category, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
    const status = STATUS_LABEL[proposal.status] ?? { label: proposal.status, cls: 'bg-gray-100 text-gray-600' }

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-md transition-all flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', cat.color)}>
                        {cat.label}
                    </span>
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', status.cls)}>
                        {status.label}
                    </span>
                </div>
                <span className="text-[10px] font-mono text-gray-400 shrink-0">{proposal.tracker_number}</span>
            </div>
            <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{proposal.title}</h3>
            {proposal.abstract && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{proposal.abstract}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 mt-auto pt-1 border-t border-gray-50">
                {proposal.pi?.name && (
                    <span className="flex items-center gap-1">
                        <Users size={10} /> {proposal.pi.name}
                    </span>
                )}
                {proposal.college?.name && (
                    <span className="flex items-center gap-1">
                        <Building2 size={10} /> {proposal.college.name}
                    </span>
                )}
                {proposal.academic_year && (
                    <span className="ml-auto font-medium text-gray-500">{proposal.academic_year}</span>
                )}
            </div>
        </div>
    )
}

export default function ResearchShowcase() {
    const [proposals, setProposals] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')
    const [page, setPage] = useState(1)

    const load = async (p = 1) => {
        setLoading(true)
        try {
            const params = { status: 'funded,midterm_evaluation,completed', per_page: 12, page: p }
            if (search) params.search = search
            if (category) params.category = category
            const r = await get('/proposals/public', params)
            setProposals(r.data?.data?.data ?? [])
            setMeta(r.data?.data ?? null)
        } catch {}
        finally { setLoading(false) }
    }

    useEffect(() => { setPage(1); load(1) }, [search, category])
    useEffect(() => { load(page) }, [page])

    const totalPages = meta?.last_page ?? 1

    return (
        <PublicLayout>
            <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">

                {/* Hero */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full">
                        <Globe size={12} /> Research Showcase
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Funded Research at RTT</h1>
                    <p className="text-gray-500 max-w-xl mx-auto">
                        Explore funded projects, ongoing research, and completed studies from across our institution.
                    </p>
                </div>

                {/* Stats bar */}
                {meta && (
                    <div className="flex items-center justify-center gap-8 text-center">
                        <div>
                            <p className="text-2xl font-bold text-indigo-600">{meta.total ?? 0}</p>
                            <p className="text-xs text-gray-500">Research Projects</p>
                        </div>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <p className="text-2xl font-bold text-green-600">{CATEGORIES.slice(1).length}</p>
                            <p className="text-xs text-gray-500">Research Areas</p>
                        </div>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <p className="text-2xl font-bold text-amber-600">Open</p>
                            <p className="text-xs text-gray-500">Access</p>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by title, abstract, or tracker number…"
                            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {CATEGORIES.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setCategory(c.value)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border',
                                    category === c.value
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'
                                )}
                            >
                                <c.Icon size={13} /> {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse space-y-3">
                                <div className="h-4 bg-gray-200 rounded w-1/3" />
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                <div className="h-3 bg-gray-100 rounded w-full" />
                                <div className="h-3 bg-gray-100 rounded w-5/6" />
                            </div>
                        ))}
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center">
                        <BookOpen size={40} className="text-gray-200 mb-4" />
                        <p className="text-gray-600 font-semibold">No research projects found</p>
                        <p className="text-sm text-gray-400 mt-1">Try a different search term or category.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {proposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                            className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl text-sm disabled:opacity-40 hover:bg-gray-50">
                            <ChevronLeft size={14} /> Prev
                        </button>
                        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                            className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl text-sm disabled:opacity-40 hover:bg-gray-50">
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        </PublicLayout>
    )
}
