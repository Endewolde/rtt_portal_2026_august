import { useState, useEffect, useCallback } from 'react';
import { Link } from '@inertiajs/react';
import {
    MapPin, Calendar, Clock, Users, Video, Building2, Globe,
    Search, Grid3x3, List, ChevronLeft, ChevronRight, Tag,
    Star, ArrowRight, X, Sparkles, TrendingUp, CalendarDays,
    Filter, ChevronDown,
} from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d, opts = {}) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...opts });
}
function fmtTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const TYPE_CFG = {
    physical: { label: 'In-Person',  Icon: Building2, color: '#3b82f6', bg: '#eff6ff', ring: '#bfdbfe' },
    virtual:  { label: 'Virtual',    Icon: Video,     color: '#10b981', bg: '#f0fdf4', ring: '#bbf7d0' },
    hybrid:   { label: 'Hybrid',     Icon: Globe,     color: '#8b5cf6', bg: '#f5f3ff', ring: '#ddd6fe' },
};

function countdown(startDate) {
    if (!startDate) return null;
    const diff = new Date(startDate) - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86_400_000);
    if (days > 60) return null;
    return { days, urgent: days <= 7 };
}

// ─── Grid Card ────────────────────────────────────────────────────────────────

function GridCard({ conf }) {
    const type  = TYPE_CFG[conf.location_type] ?? TYPE_CFG.physical;
    const cd    = countdown(conf.start_date);

    return (
        <Link
            href={`/conferences/${conf.slug}`}
            className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col
                       hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1.5
                       transition-all duration-300"
        >
            {/* Banner */}
            <div className="relative h-44 overflow-hidden shrink-0">
                {conf.banner_image
                    ? <img src={conf.banner_image} alt={conf.title}
                           className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center"
                           style={{ background: `linear-gradient(135deg, ${type.color}22, ${type.color}44)` }}>
                          <CalendarDays size={44} style={{ color: `${type.color}88` }} />
                      </div>
                }

                {/* Top badges */}
                <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full text-white shadow-sm"
                        style={{ backgroundColor: type.color }}>
                        <type.Icon size={9} /> {type.label}
                    </span>
                    {conf.is_featured && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1
                                         bg-amber-400 text-amber-900 rounded-full shadow-sm">
                            <Star size={8} className="fill-amber-900" /> Featured
                        </span>
                    )}
                </div>

                {/* Countdown pill */}
                {cd && (
                    <div className={`absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold
                                     px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm
                                     ${cd.urgent ? 'bg-red-500 text-white' : 'bg-white/95 text-indigo-700'}`}>
                        <Clock size={9} className={cd.urgent ? 'animate-pulse' : ''} />
                        {cd.days}d left
                    </div>
                )}

                {/* Gradient overlay at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/30 to-transparent" />
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col flex-1">
                <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2
                               group-hover:text-indigo-700 transition-colors mb-2.5">
                    {conf.title}
                </h3>

                {conf.description && (
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">{conf.description}</p>
                )}

                <div className="flex-1" />

                {/* Meta row */}
                <div className="pt-3 mt-2 border-t border-gray-50 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar size={11} className="text-gray-400 shrink-0" />
                        <span>
                            {fmtDate(conf.start_date)}
                            {conf.end_date && ` — ${fmtDate(conf.end_date)}`}
                        </span>
                    </div>
                    {conf.location_address && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <MapPin size={11} className="text-gray-400 shrink-0" />
                            <span className="truncate">{conf.location_address}</span>
                        </div>
                    )}
                    {(conf.speakers_count > 0 || conf.registrations_count > 0) && (
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            {conf.speakers_count > 0 && (
                                <span className="flex items-center gap-1">
                                    <Users size={10} /> {conf.speakers_count} speaker{conf.speakers_count !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Tags */}
                {conf.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                        {conf.tags.slice(0, 3).map(t => (
                            <span key={t} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                                #{t}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer CTA */}
            <div className="px-5 pb-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">{fmtTime(conf.start_date)}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-indigo-500
                                     group-hover:text-indigo-700 group-hover:gap-1.5 transition-all duration-200">
                        View details <ArrowRight size={11} />
                    </span>
                </div>
            </div>
        </Link>
    );
}

// ─── List Card ────────────────────────────────────────────────────────────────

function ListCard({ conf }) {
    const type = TYPE_CFG[conf.location_type] ?? TYPE_CFG.physical;
    const cd   = countdown(conf.start_date);

    return (
        <Link
            href={`/conferences/${conf.slug}`}
            className="group flex bg-white rounded-2xl border border-gray-100 overflow-hidden
                       hover:shadow-xl hover:shadow-indigo-500/8 hover:border-indigo-100
                       transition-all duration-300"
        >
            {/* Left image/date block */}
            <div className="w-36 sm:w-48 shrink-0 relative overflow-hidden">
                {conf.banner_image
                    ? <img src={conf.banner_image} alt={conf.title}
                           className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-1 py-4"
                           style={{ background: `linear-gradient(135deg, ${type.color}22, ${type.color}55)` }}>
                          <span className="text-xs font-bold uppercase tracking-wider"
                              style={{ color: type.color }}>
                              {conf.start_date ? new Date(conf.start_date).toLocaleDateString('en-GB', { month: 'short' }) : '—'}
                          </span>
                          <span className="text-4xl font-black" style={{ color: type.color }}>
                              {conf.start_date ? new Date(conf.start_date).getDate() : '—'}
                          </span>
                          <span className="text-[10px] font-medium" style={{ color: `${type.color}99` }}>
                              {conf.start_date ? new Date(conf.start_date).getFullYear() : ''}
                          </span>
                      </div>
                }
                {conf.is_featured && (
                    <div className="absolute top-2 left-2">
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5
                                         bg-amber-400 text-amber-900 rounded-full">
                            <Star size={7} className="fill-amber-900" /> Featured
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: type.color }}>
                            <type.Icon size={9} /> {type.label}
                        </span>
                        {cd && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                cd.urgent ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'
                            }`}>
                                <Clock size={8} className={`inline mr-0.5 ${cd.urgent ? 'animate-pulse' : ''}`} />
                                {cd.days}d to go
                            </span>
                        )}
                        {conf.tags?.slice(0, 2).map(t => (
                            <span key={t} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                #{t}
                            </span>
                        ))}
                    </div>
                    <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2
                                   group-hover:text-indigo-700 transition-colors mb-1.5">
                        {conf.title}
                    </h3>
                    {conf.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{conf.description}</p>
                    )}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 mt-3">
                    <span className="flex items-center gap-1">
                        <Calendar size={10} /> {fmtDate(conf.start_date)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock size={10} /> {fmtTime(conf.start_date)}
                    </span>
                    {conf.location_address && (
                        <span className="hidden sm:flex items-center gap-1 truncate max-w-32">
                            <MapPin size={10} /> {conf.location_address}
                        </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-indigo-500 font-semibold
                                     group-hover:text-indigo-700 group-hover:gap-1.5 transition-all duration-200 shrink-0">
                        View <ArrowRight size={10} />
                    </span>
                </div>
            </div>
        </Link>
    );
}

// ─── Featured Banner Card ─────────────────────────────────────────────────────

function FeaturedCard({ conf }) {
    const type = TYPE_CFG[conf.location_type] ?? TYPE_CFG.physical;
    const cd   = countdown(conf.start_date);

    return (
        <Link href={`/conferences/${conf.slug}`}
            className="group relative rounded-3xl overflow-hidden h-72 block flex-1 min-w-0">
            {conf.banner_image
                ? <img src={conf.banner_image} alt={conf.title}
                       className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                : <div className="w-full h-full"
                       style={{ background: `linear-gradient(135deg, ${type.color}99, ${type.color})` }} />
            }
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                        style={{ backgroundColor: type.color }}>
                        <type.Icon size={9} /> {type.label}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1
                                     bg-amber-400 text-amber-900 rounded-full">
                        <Star size={8} className="fill-amber-900" /> Featured
                    </span>
                    {cd && (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            cd.urgent ? 'bg-red-500 text-white' : 'bg-white/20 text-white backdrop-blur-sm'
                        }`}>
                            {cd.days}d left
                        </span>
                    )}
                </div>
                <h3 className="text-white font-black text-xl leading-snug mb-2 line-clamp-2
                               group-hover:text-amber-300 transition-colors">
                    {conf.title}
                </h3>
                <div className="flex items-center gap-3 text-white/70 text-xs">
                    <span className="flex items-center gap-1"><Calendar size={10} /> {fmtDate(conf.start_date)}</span>
                    {conf.location_address && (
                        <span className="flex items-center gap-1 truncate">
                            <MapPin size={10} /> {conf.location_address}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Conferences() {
    const [conferences, setConferences] = useState([]);
    const [featured,    setFeatured]    = useState([]);
    const [meta,        setMeta]        = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [view,        setView]        = useState('grid');
    const [page,        setPage]        = useState(1);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [search,  setSearch]  = useState('');
    const [scope,   setScope]   = useState('upcoming');
    const [locType, setLocType] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        const params = { page, scope, per_page: 12 };
        if (search)  params.search        = search;
        if (locType) params.location_type = locType;

        get('/conferences', params)
            .then(res => {
                const pg = res.data;
                setConferences(pg?.data ?? (Array.isArray(pg) ? pg : []));
                if (pg?.total != null) setMeta(pg);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [page, scope, search, locType]);

    useEffect(() => { load(); }, [load]);

    // Fetch featured separately (once)
    useEffect(() => {
        get('/conferences', { scope: 'upcoming', per_page: 3, is_featured: 1 })
            .then(res => {
                const pg = res.data;
                const all = pg?.data ?? (Array.isArray(pg) ? pg : []);
                setFeatured(all.filter(c => c.is_featured).slice(0, 3));
            })
            .catch(() => {});
    }, []);

    const totalPages = meta ? Math.ceil(meta.total / (meta.per_page || 12)) : 1;
    const hasFilters = search || locType;

    return (
        <PublicLayout>
            {/* ── Hero ── */}
            <div className="relative overflow-hidden bg-linear-to-br from-indigo-950 via-indigo-900 to-violet-900">
                {/* Decorative orbs */}
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
                <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-indigo-400/15 blur-3xl" />

                <div className="relative max-w-7xl mx-auto px-6 py-20">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest
                                         bg-white/10 text-indigo-300 border border-white/10 px-3 py-1 rounded-full">
                            <Sparkles size={10} /> Events & Conferences
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                        Conferences &amp; Academic
                        <span className="block text-transparent bg-clip-text bg-linear-to-r from-violet-300 to-indigo-200">
                            Events
                        </span>
                    </h1>
                    <p className="text-indigo-200 text-lg max-w-2xl leading-relaxed">
                        Discover upcoming conferences, workshops, and seminars. Connect with researchers,
                        share your work, and expand your network.
                    </p>

                    {/* Quick stats */}
                    {meta && (
                        <div className="flex items-center gap-6 mt-8">
                            <div className="text-center">
                                <div className="text-3xl font-black text-white">{meta.total}</div>
                                <div className="text-xs text-indigo-400 uppercase tracking-wider mt-0.5">
                                    {scope === 'upcoming' ? 'Upcoming' : scope === 'past' ? 'Past' : 'Total'}
                                </div>
                            </div>
                            <div className="w-px h-10 bg-white/10" />
                            <div className="text-center">
                                <div className="text-3xl font-black text-white">{featured.length}</div>
                                <div className="text-xs text-indigo-400 uppercase tracking-wider mt-0.5">Featured</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-10">

                {/* ── Featured conferences ── */}
                {scope === 'upcoming' && featured.length > 0 && !search && !locType && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-5">
                            <Star size={15} className="text-amber-500 fill-amber-500" />
                            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Featured Events</h2>
                        </div>
                        <div className={`grid gap-4 ${
                            featured.length === 1 ? 'grid-cols-1' :
                            featured.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                            'grid-cols-1 sm:grid-cols-3'
                        }`}>
                            {featured.map(c => <FeaturedCard key={c.id} conf={c} />)}
                        </div>
                    </div>
                )}

                {/* ── Controls ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-8">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Search conferences…"
                                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50
                                           focus:bg-white transition-colors"
                            />
                            {search && (
                                <button onClick={() => { setSearch(''); setPage(1); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {/* Scope */}
                            <div className="relative">
                                <select value={scope} onChange={e => { setScope(e.target.value); setPage(1); }}
                                    className="appearance-none py-2.5 pl-3 pr-8 rounded-xl border border-gray-200
                                               text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                                               focus:ring-indigo-500 text-gray-700 transition-colors">
                                    <option value="upcoming">Upcoming</option>
                                    <option value="past">Past</option>
                                    <option value="all">All</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>

                            {/* Location type */}
                            <div className="relative">
                                <select value={locType} onChange={e => { setLocType(e.target.value); setPage(1); }}
                                    className="appearance-none py-2.5 pl-3 pr-8 rounded-xl border border-gray-200
                                               text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2
                                               focus:ring-indigo-500 text-gray-700 transition-colors">
                                    <option value="">All Types</option>
                                    <option value="physical">In-Person</option>
                                    <option value="virtual">Virtual</option>
                                    <option value="hybrid">Hybrid</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>

                            {/* View toggle */}
                            <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                                <button onClick={() => setView('grid')}
                                    className={`px-3 py-2.5 transition-colors ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                                    <Grid3x3 size={15} />
                                </button>
                                <button onClick={() => setView('list')}
                                    className={`px-3 py-2.5 transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                                    <List size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Active filter chips ── */}
                {hasFilters && (
                    <div className="flex flex-wrap items-center gap-2 mb-5">
                        <span className="text-xs text-gray-500 font-medium">Filters:</span>
                        {search && (
                            <button onClick={() => { setSearch(''); setPage(1); }}
                                className="flex items-center gap-1 text-xs px-3 py-1 bg-indigo-50 text-indigo-700
                                           rounded-full border border-indigo-200 hover:bg-indigo-100 transition-colors">
                                "{search}" <X size={10} />
                            </button>
                        )}
                        {locType && (
                            <button onClick={() => { setLocType(''); setPage(1); }}
                                className="flex items-center gap-1 text-xs px-3 py-1 bg-indigo-50 text-indigo-700
                                           rounded-full border border-indigo-200 hover:bg-indigo-100 transition-colors">
                                {TYPE_CFG[locType]?.label} <X size={10} />
                            </button>
                        )}
                    </div>
                )}

                {/* ── Result count ── */}
                {!loading && meta && (
                    <p className="text-sm text-gray-500 mb-6">
                        <span className="font-semibold text-gray-900">{meta.total}</span> conference{meta.total !== 1 ? 's' : ''} found
                        {scope === 'upcoming' && ' coming up'}
                        {scope === 'past' && ' in the past'}
                    </p>
                )}

                {/* ── Grid / List ── */}
                {loading ? (
                    <div className={view === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                        : 'space-y-4'}>
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className={`rounded-2xl bg-gray-100 animate-pulse ${view === 'grid' ? 'h-72' : 'h-36'}`} />
                        ))}
                    </div>
                ) : conferences.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-3xl border border-gray-100">
                        <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
                            <CalendarDays size={36} className="text-indigo-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-700 mb-1">No conferences found</h3>
                        <p className="text-sm text-gray-400">
                            {hasFilters ? 'Try adjusting your search or filters.' : 'Check back soon for upcoming events.'}
                        </p>
                        {hasFilters && (
                            <button onClick={() => { setSearch(''); setLocType(''); setPage(1); }}
                                className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : view === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {conferences.map(c => <GridCard key={c.id} conf={c} />)}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {conferences.map(c => <ListCard key={c.id} conf={c} />)}
                    </div>
                )}

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-12">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50
                                       disabled:opacity-40 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                            const pg = i + 1;
                            return (
                                <button key={pg} onClick={() => setPage(pg)}
                                    className={`w-9 h-9 rounded-xl text-sm font-semibold transition-colors ${
                                        page === pg
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}>
                                    {pg}
                                </button>
                            );
                        })}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50
                                       disabled:opacity-40 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </PublicLayout>
    );
}
