import { useState, useEffect, useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import {
    Search, X, ChevronLeft, ChevronRight, Globe, Calendar,
    DollarSign, Tag, Inbox, Loader2, Star, Clock, ArrowRight,
    Building2, Banknote, Filter,
} from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';

// ─── Config ────────────────────────────────────────────────────────────────────

const CATEGORIES = {
    research:             { label: 'Research',      color: '#3b82f6', bg: '#eff6ff' },
    community_engagement: { label: 'Community',     color: '#10b981', bg: '#f0fdf4' },
    technology_transfer:  { label: 'Tech Transfer', color: '#8b5cf6', bg: '#f5f3ff' },
    innovation:           { label: 'Innovation',    color: '#f59e0b', bg: '#fffbeb' },
    other:                { label: 'Other',         color: '#64748b', bg: '#f8fafc' },
};

const TYPES = [
    { value: '',            label: 'All Types'    },
    { value: 'grant',       label: 'Grant'        },
    { value: 'contract',    label: 'Contract'     },
    { value: 'fellowship',  label: 'Fellowship'   },
    { value: 'scholarship', label: 'Scholarship'  },
    { value: 'other',       label: 'Other'        },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function deadlineInfo(deadline) {
    if (!deadline) return null;
    const diff = Math.floor((new Date(deadline) - Date.now()) / 86_400_000);
    if (diff < 0)  return { label: 'Closed',       cls: 'text-gray-400',          urgent: false };
    if (diff === 0) return { label: 'Closes today!',cls: 'text-red-600 font-bold', urgent: true  };
    if (diff <= 7)  return { label: `${diff}d left`, cls: 'text-orange-600 font-semibold', urgent: true };
    if (diff <= 30) return { label: `${diff}d left`, cls: 'text-amber-600 font-medium',    urgent: false };
    return {
        label: new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        cls: 'text-gray-500',
        urgent: false,
    };
}

function fmtMoney(min, max, currency = 'USD') {
    if (!min && !max) return null;
    const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (min && max) return `${currency} ${fmt(min)} – ${fmt(max)}`;
    if (max)        return `Up to ${currency} ${fmt(max)}`;
    return `From ${currency} ${fmt(min)}`;
}

// ─── Card skeleton ─────────────────────────────────────────────────────────────

function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
            <div className="h-1 bg-gray-100" />
            <div className="p-5 space-y-3">
                <div className="flex gap-2">
                    <div className="h-5 w-20 bg-gray-100 rounded-full" />
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                </div>
                <div className="h-4 bg-gray-100 rounded w-5/6" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mt-2" />
                <div className="border-t border-gray-50 pt-3 flex justify-between">
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
            </div>
        </div>
    );
}

// ─── Opportunity Card ──────────────────────────────────────────────────────────

function OpportunityCard({ opp, primaryColor }) {
    const cat      = CATEGORIES[opp.category] ?? CATEGORIES.other;
    const deadline = deadlineInfo(opp.deadline);
    const money    = fmtMoney(opp.amount_min, opp.amount_max, opp.currency);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden
                        hover:shadow-xl hover:shadow-gray-200/60 hover:-translate-y-1
                        transition-all duration-200 flex flex-col group">

            {/* Category accent */}
            <div className="h-1 shrink-0" style={{ backgroundColor: cat.color }} />

            <div className="p-5 flex flex-col flex-1">

                {/* Badges */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{ color: cat.color, backgroundColor: cat.bg }}>
                            <Tag size={9} /> {cat.label}
                        </span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                            {opp.type}
                        </span>
                    </div>
                    {opp.is_featured && (
                        <Star size={14} className="text-amber-400 fill-amber-400 shrink-0 mt-0.5" />
                    )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 mb-1.5 group-hover:text-indigo-700 transition-colors">
                    {opp.title}
                </h3>

                {/* Agency */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                    <Building2 size={11} className="shrink-0" />
                    <span className="truncate">{opp.agency?.name ?? '—'}</span>
                    {opp.agency?.country && (
                        <span className="text-gray-300">· {opp.agency.country}</span>
                    )}
                </div>

                {/* Description excerpt */}
                {opp.description && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1 mb-3">
                        {opp.description}
                    </p>
                )}

                <div className="mt-auto" />

                {/* Footer */}
                <div className="border-t border-gray-50 pt-3 space-y-2">
                    {/* Money */}
                    {money && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <DollarSign size={11} className="shrink-0" />
                            {money}
                        </div>
                    )}

                    {/* Deadline + apply */}
                    <div className="flex items-center justify-between">
                        {deadline ? (
                            <span className={`flex items-center gap-1 text-xs ${deadline.cls}`}>
                                <Clock size={11} className={deadline.urgent ? 'animate-pulse' : ''} />
                                {deadline.label}
                            </span>
                        ) : (
                            <span />
                        )}
                        <a
                            href={opp.agency?.website ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => { if (!opp.agency?.website) e.preventDefault(); }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white transition-all"
                            style={{ backgroundColor: primaryColor }}>
                            Apply <ArrowRight size={10} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FundingOpportunities() {
    const s            = usePage().props.app_settings ?? {};
    const primaryColor = s.primary_color || '#c0392b';

    const [opportunities, setOpportunities] = useState([]);
    const [meta, setMeta]                   = useState({});
    const [loading, setLoading]             = useState(true);
    const [search, setDraft]                = useState('');
    const [committed, setCommitted]         = useState('');
    const [category, setCategory]           = useState('');
    const [type, setType]                   = useState('');
    const [page, setPage]                   = useState(1);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => { setCommitted(search); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(() => {
        setLoading(true);
        const params = { page, per_page: 12 };
        if (committed) params.search   = committed;
        if (category)  params.category = category;
        if (type)      params.type     = type;

        get('/external-funds/opportunities/public', params)
            .then(r => {
                const pg = r.data ?? r;
                setOpportunities(Array.isArray(pg) ? pg : (pg.data ?? []));
                if (pg?.total != null) setMeta(pg);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [page, committed, category, type]);

    useEffect(() => { load(); }, [load]);

    const totalPages = meta.last_page ?? 1;
    const hasFilters = committed || category || type;

    const clearFilters = () => { setDraft(''); setCommitted(''); setCategory(''); setType(''); setPage(1); };

    return (
        <PublicLayout>

            {/* Hero */}
            <div className="relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 60%, ${primaryColor}88 100%)` }}>
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10 bg-white" />
                <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-10 bg-white" />

                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14 text-center">
                    <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-semibold
                                    px-3 py-1.5 rounded-full mb-5 backdrop-blur-sm">
                        <Banknote size={12} /> External Funding Opportunities
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
                        Find Funding for Your Research
                    </h1>
                    <p className="text-white/80 text-base mb-8 max-w-xl mx-auto">
                        Browse open grants, fellowships, and contracts from international agencies,
                        governments, and NGOs — updated as new calls are published.
                    </p>

                    {/* Search */}
                    <div className="relative max-w-2xl mx-auto">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            value={search}
                            onChange={e => setDraft(e.target.value)}
                            placeholder="Search by title, keyword, or agency…"
                            className="w-full pl-12 pr-12 py-4 rounded-2xl text-sm text-gray-900 bg-white
                                       shadow-xl shadow-black/20 border-0 focus:outline-none focus:ring-2
                                       focus:ring-white/50 placeholder-gray-400"
                        />
                        {search && (
                            <button onClick={() => setDraft('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* Filter bar */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">

                    {/* Category pills */}
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => { setCategory(''); setPage(1); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                                !category ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                            style={!category ? { backgroundColor: primaryColor } : {}}>
                            All Categories
                        </button>
                        {Object.entries(CATEGORIES).map(([val, c]) => (
                            <button key={val}
                                onClick={() => { setCategory(category === val ? '' : val); setPage(1); }}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                                    category === val ? 'border-current shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                                style={category === val ? { color: c.color, backgroundColor: c.bg, borderColor: c.color } : {}}>
                                {c.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 ml-auto shrink-0">
                        {/* Type filter */}
                        <div className="relative">
                            <Filter size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
                                className="pl-7 pr-7 py-1.5 rounded-lg border border-gray-200 text-xs bg-white
                                           focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-600 appearance-none">
                                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>

                        {/* Results count */}
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                            {loading
                                ? '…'
                                : <><span className="font-bold text-gray-700">{meta.total ?? opportunities.length}</span> open</>
                            }
                        </span>

                        {/* Clear */}
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-red-100 transition-colors">
                                <X size={10} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
                    </div>
                ) : opportunities.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-24">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                            <Inbox size={24} className="text-gray-300" />
                        </div>
                        <p className="text-sm font-bold text-gray-400">No open opportunities right now</p>
                        <p className="text-xs text-gray-300 mt-1 mb-5">Check back soon — new calls are added regularly</p>
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
                                <X size={13} /> Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {opportunities.map(opp => (
                            <OpportunityCard key={opp.id} opp={opp} primaryColor={primaryColor} />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-gray-400">
                            Page <span className="font-semibold text-gray-700">{page}</span> of{' '}
                            <span className="font-semibold text-gray-700">{totalPages}</span>
                        </p>
                        <div className="flex items-center gap-1">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-gray-200
                                           rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                                <ChevronLeft size={13} /> Prev
                            </button>
                            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                                return (
                                    <button key={pg} onClick={() => setPage(pg)}
                                        className={`w-8 h-8 text-xs font-semibold rounded-lg border transition-colors ${
                                            pg === page ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                        style={pg === page ? { backgroundColor: primaryColor } : {}}>
                                        {pg}
                                    </button>
                                );
                            })}
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-gray-200
                                           rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                                Next <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                )}

                {/* CTA for researchers */}
                <div className="rounded-2xl p-8 text-center text-white"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
                    <Globe size={32} className="mx-auto mb-3 opacity-80" />
                    <h2 className="text-lg font-bold mb-1">Ready to Apply?</h2>
                    <p className="text-sm text-white/80 max-w-md mx-auto mb-5">
                        Sign in to your account to submit a grant application through the RTT platform
                        and track it through the internal review process.
                    </p>
                    <a href="/login"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-white font-bold text-sm rounded-xl transition-all hover:shadow-lg"
                        style={{ color: primaryColor }}>
                        Sign In to Apply <ArrowRight size={14} />
                    </a>
                </div>

            </div>
        </PublicLayout>
    );
}
