import { useState, useEffect, useCallback, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import {
    Search, X, ChevronLeft,
    ChevronRight, BookOpen, Building2, Inbox,
    TrendingUp, FlaskConical, Users, Lightbulb, LayoutGrid,
    Archive, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import StatusBadge from '../../Components/StatusBadge';
import { get } from '../../lib/api';
import { timeAgo } from '../../lib/utils';

// ─── Config ────────────────────────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'research',             label: 'Research',        Icon: FlaskConical, color: '#3b82f6', bg: '#eff6ff' },
    { value: 'community_engagement', label: 'Community',       Icon: Users,        color: '#10b981', bg: '#f0fdf4' },
    { value: 'technology_transfer',  label: 'Tech Transfer',   Icon: TrendingUp,   color: '#8b5cf6', bg: '#f5f3ff' },
    { value: 'innovation',           label: 'Innovation',      Icon: Lightbulb,    color: '#f59e0b', bg: '#fffbeb' },
    { value: 'other',                label: 'Other',           Icon: LayoutGrid,   color: '#64748b', bg: '#f8fafc' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

const ARCHIVE_CATEGORIES = [
    { value: '', label: 'All Categories' },
    ...CATEGORIES.map(c => ({ value: c.value, label: c.label })),
];

// ─── Shared helpers ────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-400">
                Page <span className="font-semibold text-gray-700">{page}</span> of{' '}
                <span className="font-semibold text-gray-700">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1">
                <button
                    disabled={page <= 1}
                    onClick={() => onPage(page - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-gray-200
                               rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={13} /> Prev
                </button>
                {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return (
                        <button key={pg} onClick={() => onPage(pg)}
                            className={[
                                'w-8 h-8 text-xs font-semibold rounded-lg border transition-colors',
                                pg === page ? 'bg-indigo-600 text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                            ].join(' ')}>
                            {pg}
                        </button>
                    );
                })}
                <button
                    disabled={page >= totalPages}
                    onClick={() => onPage(page + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-gray-200
                               rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Next <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
}

function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
            <div className="h-1 bg-gray-100 w-full" />
            <div className="p-5 space-y-3">
                <div className="flex gap-2">
                    <div className="h-5 w-20 bg-gray-100 rounded-full" />
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                </div>
                <div className="space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-5/6" />
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                </div>
                <div className="pt-2 border-t border-gray-50 flex justify-between">
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                    <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
            </div>
        </div>
    );
}

// ─── Archive Project Card ───────────────────────────────────────────────────────

function ArchiveCard({ proposal: p }) {
    const cat = CAT_MAP[p.category] ?? CAT_MAP.other;
    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden
                        hover:shadow-md hover:shadow-gray-200/60 hover:-translate-y-0.5
                        transition-all duration-200 flex flex-col group">
            <div className="h-1 w-full shrink-0" style={{ backgroundColor: cat.color }} />
            <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                            style={{ color: cat.color, backgroundColor: cat.bg }}>
                            {p.tracker_number}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: cat.color, backgroundColor: cat.bg }}>
                            <cat.Icon size={9} /> {cat.label}
                        </span>
                        <StatusBadge status={p.status} />
                    </div>
                </div>
                <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 mb-2
                               group-hover:text-teal-700 transition-colors">
                    {p.title}
                </h3>
                {p.abstract ? (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1 mb-3">{p.abstract}</p>
                ) : (
                    <div className="flex-1 mb-3" />
                )}
                <div className="space-y-1.5 border-t border-gray-50 pt-3">
                    {p.pi?.name && (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                            <Users size={10} className="shrink-0 text-gray-300" />
                            <span className="truncate">{p.pi.name}</span>
                        </div>
                    )}
                    {p.college?.name && (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Building2 size={10} className="shrink-0 text-gray-300" />
                            <span className="truncate">{p.college.name}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function YearCard({ year, count, onSelect }) {
    return (
        <button
            onClick={() => onSelect(year)}
            className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md
                       hover:border-teal-200 transition-all p-6 text-left group"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 bg-teal-50 rounded-xl flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <Archive size={20} className="text-teal-600" />
                </div>
                <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded-lg font-semibold">
                    {count} {count === 1 ? 'project' : 'projects'}
                </span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{year}</h3>
            <p className="text-xs text-gray-400 mb-4">Academic Year</p>
            <div className="flex items-center gap-1 text-xs text-teal-600 font-medium group-hover:gap-2 transition-all">
                <span>Browse projects</span>
                <ChevronRight size={12} />
            </div>
        </button>
    );
}

// ─── Parse description text into individual lines ─────────────────────────────

function parseTopics(area) {
    // Prefer explicit sub_topics array if populated
    if (Array.isArray(area.sub_topics) && area.sub_topics.length > 0) {
        return area.sub_topics.filter(t => t?.trim());
    }
    // Fall back to description lines (handles "1.\tFishery...\n2.\tFood..." format)
    if (area.description) {
        return area.description
            .split('\n')
            .map(l => l.trim().replace(/^\d+\.\s*/, '').trim())  // strip leading "1." numbering
            .filter(l => l.length > 0);
    }
    return [];
}

// ─── Expandable thematic area card ────────────────────────────────────────────

function ThematicCard({ area }) {
    const [open, setOpen] = useState(false);
    const topics = parseTopics(area);

    return (
        <div
            className="bg-white rounded-2xl border transition-all duration-200"
            style={{
                borderColor: open ? `${area.color}50` : '#f3f4f6',
                boxShadow:   open ? '0 4px 24px 0 rgba(0,0,0,0.07)' : undefined,
            }}
        >
            {/* Card header — always visible, acts as toggle */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full text-left p-5 flex items-start gap-4 group"
            >
                {/* Icon */}
                <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0
                               transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: `${area.color}18`, border: `1.5px solid ${area.color}30` }}
                >
                    {area.icon}
                </div>

                {/* Title + sub-topic count */}
                <div className="flex-1 min-w-0">
                    <div className="w-8 h-1 rounded-full mb-2" style={{ backgroundColor: area.color }} />
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{area.name}</h3>
                    {topics.length > 0 && !open && (
                        <p className="text-[11px] mt-1.5 font-semibold" style={{ color: area.color }}>
                            {topics.length} sub-topic{topics.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>

                {/* Toggle chevron */}
                {topics.length > 0 && (
                    <div
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                        style={{ backgroundColor: open ? `${area.color}15` : '#f3f4f6' }}
                    >
                        {open
                            ? <ChevronUp size={13} style={{ color: area.color }} />
                            : <ChevronDown size={13} className="text-gray-400" />
                        }
                    </div>
                )}
            </button>

            {/* Expanded: numbered list, one item per row */}
            {open && topics.length > 0 && (
                <div style={{ padding: '0 20px 20px' }}>
                    <div style={{ borderTop: `1px solid ${area.color}20`, paddingTop: '14px' }}>
                        {topics.map((t, i) => (
                            <div
                                key={i}
                                style={{
                                    display:       'flex',
                                    alignItems:    'flex-start',
                                    gap:           '10px',
                                    marginBottom:  i < topics.length - 1 ? '10px' : 0,
                                }}
                            >
                                <span
                                    style={{
                                        display:         'flex',
                                        alignItems:      'center',
                                        justifyContent:  'center',
                                        flexShrink:      0,
                                        width:           '20px',
                                        height:          '20px',
                                        minWidth:        '20px',
                                        borderRadius:    '50%',
                                        backgroundColor: area.color,
                                        color:           '#fff',
                                        fontSize:        '10px',
                                        fontWeight:      700,
                                        marginTop:       '2px',
                                    }}
                                >
                                    {i + 1}
                                </span>
                                <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                                    {t}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Thematic Areas Section ─────────────────────────────────────────────────────

function ThematicAreasSection() {
    const [areas, setAreas]     = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        get('/thematic-areas/public')
            .then(r => setAreas(r?.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-28" />
                ))}
            </div>
        );
    }

    if (areas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
                <FlaskConical size={40} className="text-gray-200 mb-3" />
                <p className="text-gray-400 font-medium">No thematic areas defined yet</p>
                <p className="text-sm text-gray-300 mt-1">Check back soon.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map(area => <ThematicCard key={area.id} area={area} />)}
        </div>
    );
}

// ─── Completed Archive Section ─────────────────────────────────────────────────

function ArchiveSection() {
    const [yearSummaries, setYearSummaries] = useState([]);
    const [loadingYears, setLoadingYears]   = useState(true);
    const [selectedYear, setSelectedYear]   = useState(null);
    const [colleges, setColleges]           = useState([]);

    const [proposals, setProposals]       = useState([]);
    const [loadingProps, setLoadingProps] = useState(false);
    const [page, setPage]                 = useState(1);
    const [lastPage, setLastPage]         = useState(1);
    const [total, setTotal]               = useState(0);

    const [filters, setFilters] = useState({ search: '', pi_search: '', college_id: '', category: '', status: '' });

    useEffect(() => {
        get('/proposals/public/archive/years')
            .then(r => setYearSummaries(r.data ?? []))
            .catch(() => {})
            .finally(() => setLoadingYears(false));

        get('/colleges/public')
            .then(r => setColleges(r.data ?? []))
            .catch(() => {});
    }, []);

    const loadProposals = useCallback(async (year, f, pg = 1) => {
        setLoadingProps(true);
        try {
            const params = {
                status: f.status ? f.status : 'completed,archived',
                academic_year: year,
                per_page: 20,
                page: pg,
                sort: 'newest',
            };
            if (f.search)     params.search     = f.search;
            if (f.pi_search)  params.pi_search  = f.pi_search;
            if (f.college_id) params.college_id = f.college_id;
            if (f.category)   params.category   = f.category;

            const r = await get('/proposals/public', params);
            const paginated = r.data;
            setProposals(paginated?.data ?? []);
            setLastPage(paginated?.last_page ?? 1);
            setTotal(paginated?.total ?? 0);
            setPage(pg);
        } catch { /* non-critical */ }
        setLoadingProps(false);
    }, []);

    useEffect(() => {
        if (!selectedYear) return;
        const t = setTimeout(() => loadProposals(selectedYear, filters, 1), 350);
        return () => clearTimeout(t);
    }, [filters, selectedYear]);

    const selectYear = (year) => {
        const blank = { search: '', pi_search: '', college_id: '', category: '', status: '' };
        setFilters(blank);
        setSelectedYear(year);
        loadProposals(year, blank, 1);
    };

    const setFilter    = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const clearFilters = () => setFilters({ search: '', pi_search: '', college_id: '', category: '', status: '' });
    const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

    if (!selectedYear) {
        return (
            <div className="space-y-6">
                {!loadingYears && yearSummaries.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 text-center">
                            <p className="text-2xl font-bold text-teal-600">{yearSummaries.length}</p>
                            <p className="text-xs text-gray-500 mt-1">Academic Years</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 text-center">
                            <p className="text-2xl font-bold text-gray-900">
                                {yearSummaries.reduce((s, y) => s + y.count, 0)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Completed Projects</p>
                        </div>
                    </div>
                )}

                {loadingYears ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : yearSummaries.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                        <Archive size={40} className="mx-auto text-gray-200 mb-4" />
                        <h3 className="text-gray-500 font-medium mb-1">No completed projects yet</h3>
                        <p className="text-sm text-gray-400">Completed and archived proposals will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {yearSummaries.map(y => (
                            <YearCard key={y.year} year={y.year} count={y.count} onSelect={selectYear} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setSelectedYear(null)}
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200
                               text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="h-10 w-10 bg-teal-50 rounded-xl flex items-center justify-center">
                    <Archive size={18} className="text-teal-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedYear}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Completed Project Archive · {total} project{total !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-teal-500" />
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</p>
                        {activeFilterCount > 0 && (
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                                {activeFilterCount} active
                            </span>
                        )}
                    </div>
                    {activeFilterCount > 0 && (
                        <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium">
                            <X size={11} /> Clear all
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input value={filters.search} onChange={e => setFilter('search', e.target.value)}
                            placeholder="Search by title or abstract…"
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div className="relative">
                        <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input value={filters.pi_search} onChange={e => setFilter('pi_search', e.target.value)}
                            placeholder="Search by PI name…"
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <div className="relative">
                        <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select value={filters.college_id} onChange={e => setFilter('college_id', e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none">
                            <option value="">All Colleges</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <BookOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select value={filters.category} onChange={e => setFilter('category', e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none">
                            {ARCHIVE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <Archive size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none">
                            <option value="">All Statuses</option>
                            <option value="completed">Completed</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                </div>
            </div>

            {loadingProps ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : proposals.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                    <Archive size={36} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-500 font-medium">No projects match the current filters.</p>
                    {activeFilterCount > 0 && (
                        <button onClick={clearFilters} className="mt-3 text-sm text-teal-600 hover:underline">
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {proposals.map(p => <ArchiveCard key={p.id} proposal={p} />)}
                </div>
            )}

            <Pagination page={page} totalPages={lastPage} onPage={pg => loadProposals(selectedYear, filters, pg)} />
        </div>
    );
}

// ─── Menu card ─────────────────────────────────────────────────────────────────

function MenuCard({ icon: Icon, title, description, accent, hoverBg, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={[
                'group relative w-full text-left rounded-3xl border-2 p-8 transition-all duration-300',
                'focus:outline-none focus-visible:ring-4',
                active
                    ? 'shadow-xl -translate-y-1'
                    : 'border-gray-100 bg-white hover:-translate-y-1 hover:shadow-xl',
            ].join(' ')}
            style={active
                ? { borderColor: accent, backgroundColor: `${accent}08` }
                : {}}
        >
            {/* Icon */}
            <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${accent}15`, border: `1.5px solid ${accent}30` }}
            >
                <Icon size={28} style={{ color: accent }} />
            </div>

            {/* Text */}
            <h2 className="text-xl font-extrabold text-gray-900 mb-2 leading-tight">{title}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>

            {/* Active indicator */}
            <div
                className={[
                    'absolute bottom-6 right-6 flex items-center gap-1.5 text-xs font-semibold transition-all duration-200',
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                ].join(' ')}
                style={{ color: accent }}
            >
                Explore <ChevronDown size={13} className="-rotate-90" />
            </div>

            {/* Bottom accent strip */}
            <div
                className={[
                    'absolute bottom-0 left-8 right-8 h-0.5 rounded-full transition-all duration-300',
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
                ].join(' ')}
                style={{ backgroundColor: accent }}
            />
        </button>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Explore() {
    const s            = usePage().props.app_settings ?? {};
    const primaryColor = s.primary_color || '#6366f1';

    const [activeSection, setActiveSection] = useState(null);
    const contentRef = useRef(null);

    const handleSelect = (section) => {
        const next = activeSection === section ? null : section;
        setActiveSection(next);
        if (next) {
            setTimeout(() => {
                contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    };

    return (
        <PublicLayout>

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <div
                className="relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 60%, ${primaryColor}88 100%)` }}
            >
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10 bg-white" />
                <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-10 bg-white" />

                <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center">
                    <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-semibold
                                    px-3 py-1.5 rounded-full mb-5 backdrop-blur-sm">
                        <BookOpen size={12} /> Research &amp; Innovation Repository
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
                        Explore
                    </h1>
                    <p className="text-white/80 text-base max-w-xl mx-auto">
                        Choose a section below to explore thematic research areas or browse completed and archived projects.
                    </p>
                </div>
            </div>

            {/* ── Menu cards ────────────────────────────────────────────────── */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <MenuCard
                        icon={FlaskConical}
                        title="Thematic Areas"
                        description="Discover the research themes and focus areas that drive funded projects across the institution."
                        accent="#6366f1"
                        active={activeSection === 'thematic'}
                        onClick={() => handleSelect('thematic')}
                    />
                    <MenuCard
                        icon={Archive}
                        title="Completed & Archived Proposals"
                        description="Browse completed and archived research projects by academic year, college, or category."
                        accent="#0d9488"
                        active={activeSection === 'archive'}
                        onClick={() => handleSelect('archive')}
                    />
                </div>
            </div>

            {/* ── Section content ───────────────────────────────────────────── */}
            {activeSection && (
                <div ref={contentRef} className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
                    {/* Section header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                backgroundColor: activeSection === 'thematic' ? '#6366f115' : '#0d948815',
                            }}
                        >
                            {activeSection === 'thematic'
                                ? <FlaskConical size={18} className="text-indigo-600" />
                                : <Archive size={18} className="text-teal-600" />
                            }
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {activeSection === 'thematic' ? 'Thematic Areas' : 'Completed & Archived Proposals'}
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {activeSection === 'thematic'
                                    ? 'All active research thematic areas'
                                    : 'Select an academic year to browse projects'}
                            </p>
                        </div>
                        <button
                            onClick={() => setActiveSection(null)}
                            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500
                                       border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            <X size={12} /> Close
                        </button>
                    </div>

                    {activeSection === 'thematic' ? <ThematicAreasSection /> : <ArchiveSection />}
                </div>
            )}

        </PublicLayout>
    );
}
