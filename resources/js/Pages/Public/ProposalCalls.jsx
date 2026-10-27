import { useState, useEffect } from 'react';
import { Search, X, Microscope, Users, Zap, Lightbulb, LayoutGrid, Sparkles } from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import ProposalCallCard from '../../Components/ProposalCallCard';
import { get } from '../../lib/api';
import { cn } from '../../lib/utils';
import { styledProgrammes } from '../../lib/programmes';

const CATEGORY_STYLES = [
    { id: '',                    label: 'All Calls',           icon: LayoutGrid,  color: 'text-indigo-600',  active: 'bg-indigo-600 text-white border-indigo-600' },
    { id: 'research',            label: 'Research',            icon: Microscope,  color: 'text-blue-600',    active: 'bg-blue-600 text-white border-blue-600'    },
    { id: 'community_engagement',label: 'Community',           icon: Users,       color: 'text-emerald-600', active: 'bg-emerald-600 text-white border-emerald-600'},
    { id: 'technology_transfer', label: 'Technology Transfer', icon: Zap,         color: 'text-purple-600',  active: 'bg-purple-600 text-white border-purple-600' },
    { id: 'innovation',          label: 'Innovation',          icon: Lightbulb,   color: 'text-amber-600',   active: 'bg-amber-600 text-white border-amber-600'   },
];

const categories = () => styledProgrammes(CATEGORY_STYLES, 'id');

function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
            <div className="h-28 bg-linear-to-br from-slate-200 to-slate-100" />
            <div className="p-5 space-y-3">
                <div className="h-3 w-20 bg-slate-200 rounded-full" />
                <div className="h-5 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-2/3 bg-slate-100 rounded" />
                <div className="h-16 bg-slate-100 rounded-xl mt-4" />
                <div className="h-10 bg-slate-200 rounded-xl mt-2" />
            </div>
        </div>
    );
}

export default function ProposalCalls() {
    const [calls,    setCalls]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [search,   setSearch]   = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        get('/proposal-calls', { status: 'open' })
            .then((r) => {
                const raw   = r.data?.data ?? r.data ?? [];
                const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
                setCalls(items.filter(c => !c.end_date || (c.countdown_seconds ?? 1) > 0));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = calls.filter((c) => {
        const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase())
            || c.description?.toLowerCase().includes(search.toLowerCase());
        const matchCat = !category || c.category === category;
        return matchSearch && matchCat;
    });

    const urgentCount = calls.filter(c => (c.countdown_seconds ?? 0) < 7 * 86400).length;

    return (
        <PublicLayout>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div className="relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1d4ed8 100%)' }}>

                {/* Decorative blobs */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }} />
                    <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />
                </div>

                <div className="relative max-w-5xl mx-auto px-4 py-16 text-center">
                    {/* Eyebrow */}
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80
                                    text-xs font-semibold px-3 py-1.5 rounded-full mb-5 backdrop-blur-sm">
                        <Sparkles size={11} className="text-indigo-300" />
                       Built for academic excellence — Research &amp; Technology Transfer
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
                        Open Funding Calls
                    </h1>
                    <p className="text-lg text-white/60 max-w-xl mx-auto mb-10">
                        Explore active funding opportunities across research, community engagement, and technology transfer.
                    </p>

                    {/* Search */}
                    <div className="relative max-w-xl mx-auto">
                        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                        {search && (
                            <button onClick={() => setSearch('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                                <X size={15} />
                            </button>
                        )}
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search calls by title or description…"
                            className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white/10 border border-white/20
                                       text-white placeholder-white/40 text-sm backdrop-blur-sm
                                       focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all"
                        />
                    </div>

                    {/* Quick stats */}
                    {!loading && (
                        <div className="flex items-center justify-center gap-6 mt-8">
                            <div className="text-center">
                                <p className="text-2xl font-extrabold text-white tabular-nums">{calls.length}</p>
                                <p className="text-[11px] text-white/40 font-medium mt-0.5">Open calls</p>
                            </div>
                            {urgentCount > 0 && (
                                <>
                                    <div className="w-px h-8 bg-white/15" />
                                    <div className="text-center">
                                        <p className="text-2xl font-extrabold text-amber-300 tabular-nums">{urgentCount}</p>
                                        <p className="text-[11px] text-white/40 font-medium mt-0.5">Closing within 7 days</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Category tabs + content ──────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-4 py-10">

                {/* Category pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-8 -mx-1 px-1 scrollbar-none">
                    {categories().map(cat => {
                        const active = category === cat.id;
                        const count  = cat.id === '' ? calls.length : calls.filter(c => c.category === cat.id).length;
                        return (
                            <button key={cat.id} onClick={() => setCategory(cat.id)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all shrink-0',
                                    active
                                        ? cat.active + ' shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
                                )}>
                                <cat.icon size={13} className={active ? '' : cat.color} />
                                {cat.label}
                                {count > 0 && (
                                    <span className={cn(
                                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
                                        active ? 'bg-white/25' : 'bg-gray-100 text-gray-500'
                                    )}>{count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Result header */}
                {!loading && (
                    <div className="flex items-center justify-between mb-5">
                        <p className="text-sm text-gray-500">
                            {filtered.length === 0
                                ? 'No calls match your filters'
                                : (<><strong className="text-gray-800">{filtered.length}</strong> {filtered.length === 1 ? 'call' : 'calls'} found</>)
                            }
                        </p>
                        {(search || category) && (
                            <button onClick={() => { setSearch(''); setCategory(''); }}
                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-red-100 transition-all font-semibold">
                                <X size={11} /> Clear filters
                            </button>
                        )}
                    </div>
                )}

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
                            <Search size={28} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">No calls found</h3>
                        <p className="text-sm text-gray-500 max-w-sm">
                            {search
                                ? `No open calls match "${search}". Try a different keyword.`
                                : 'There are no open calls in this category right now. Check back soon.'}
                        </p>
                        {(search || category) && (
                            <button onClick={() => { setSearch(''); setCategory(''); }}
                                className="mt-5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 px-5 py-2 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors">
                                View all open calls
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(call => (
                            <ProposalCallCard key={call.id} call={call} />
                        ))}
                    </div>
                )}
            </div>
        </PublicLayout>
    );
}
