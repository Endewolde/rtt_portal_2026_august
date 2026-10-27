import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search, Filter, X, BookOpen, Award, FileText,
    Building2, Calendar, ChevronLeft, ChevronRight,
    Star, ExternalLink, Tag, Users, FlaskConical,
    Globe, ChevronDown, Microscope, Lightbulb, Handshake,
    TrendingUp, BarChart3,
} from 'lucide-react';
import { usePage } from '@inertiajs/react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';
import { getCategoryLabel, cn } from '../../lib/utils';
import { styledProgrammes } from '../../lib/programmes';

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_STYLES = [
    { value: '',                     label: 'All Research',        icon: FlaskConical },
    { value: 'research',             label: 'Research',            icon: Microscope   },
    { value: 'community_engagement', label: 'Community',           icon: Handshake    },
    { value: 'technology_transfer',  label: 'Technology Transfer', icon: TrendingUp   },
    { value: 'innovation',           label: 'Innovation',          icon: Lightbulb    },
];

const categories = () => styledProgrammes(CATEGORY_STYLES);

const CATEGORY_COLORS = {
    research:             'bg-blue-50 text-blue-700 border-blue-200',
    community_engagement: 'bg-green-50 text-green-700 border-green-200',
    technology_transfer:  'bg-purple-50 text-purple-700 border-purple-200',
    innovation:           'bg-orange-50 text-orange-700 border-orange-200',
    other:                'bg-gray-50 text-gray-600 border-gray-200',
};

const CATEGORY_ACCENT = {
    research:             'border-t-blue-500',
    community_engagement: 'border-t-green-500',
    technology_transfer:  'border-t-purple-500',
    innovation:           'border-t-orange-500',
    other:                'border-t-gray-400',
};

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ meta, page, onChange }) {
    if (!meta || meta.last_page <= 1) return null;
    const start = Math.max(1, Math.min(page - 2, meta.last_page - 4));
    const end   = Math.min(meta.last_page, start + 4);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const btn   = (content, disabled, onClick, active = false) => (
        <button key={String(content)} onClick={onClick} disabled={disabled}
            className={cn(
                'h-9 min-w-9 px-2.5 rounded-xl text-sm font-medium transition-all',
                active   ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                         : 'text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed'
            )}>
            {content}
        </button>
    );
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-10">
            <span className="text-sm text-gray-500">
                Showing <strong>{meta.from ?? 0}–{meta.to ?? 0}</strong> of{' '}
                <strong>{meta.total?.toLocaleString()}</strong> records
            </span>
            <div className="flex items-center gap-1">
                {btn(<ChevronLeft size={14} />, page === 1, () => onChange(page - 1))}
                {start > 1 && <>{btn(1, false, () => onChange(1))}{start > 2 && <span className="text-gray-400 text-sm px-1">…</span>}</>}
                {pages.map(p => btn(p, false, () => onChange(p), p === page))}
                {end < meta.last_page && <>{end < meta.last_page - 1 && <span className="text-gray-400 text-sm px-1">…</span>}{btn(meta.last_page, false, () => onChange(meta.last_page))}</>}
                {btn(<ChevronRight size={14} />, page === meta.last_page, () => onChange(page + 1))}
            </div>
        </div>
    );
}

// ─── Research card ────────────────────────────────────────────────────────────

function ResearchCard({ record, onClick }) {
    const accent  = CATEGORY_ACCENT[record.category] ?? CATEGORY_ACCENT.other;
    const catCls  = CATEGORY_COLORS[record.category] ?? CATEGORY_COLORS.other;
    const catIcon = categories().find(c => c.value === record.category)?.icon ?? FlaskConical;
    const CatIcon = catIcon;

    return (
        <article
            onClick={() => onClick(record)}
            className={cn(
                'group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg',
                'transition-all duration-200 cursor-pointer overflow-hidden flex flex-col',
                'border-t-4', accent
            )}>
            <div className="p-5 flex-1 flex flex-col gap-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                    <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', catCls)}>
                        <CatIcon size={11} />
                        {getCategoryLabel(record.category)}
                    </span>
                    {record.is_featured && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                            <Star size={10} fill="currentColor" /> Featured
                        </span>
                    )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug
                               group-hover:text-indigo-700 transition-colors">
                    {record.title}
                </h3>

                {/* Abstract */}
                {record.abstract && (
                    <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed flex-1">
                        {record.abstract}
                    </p>
                )}

                {/* Keywords */}
                {record.keywords && (
                    <div className="flex flex-wrap gap-1">
                        {String(record.keywords).split(',').slice(0, 3).map(kw => (
                            <span key={kw.trim()}
                                className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                <Tag size={8} /> {kw.trim()}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-50 px-5 py-3 space-y-2">
                {/* PI + College */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Users size={11} className="text-gray-300 shrink-0" />
                        <span className="text-xs text-gray-600 truncate font-medium">{record.pi_name || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Calendar size={11} className="text-gray-300" />
                        <span className="text-xs text-gray-400">{record.academic_year}</span>
                    </div>
                </div>
                {record.college?.name && (
                    <div className="flex items-center gap-1.5">
                        <Building2 size={11} className="text-gray-300 shrink-0" />
                        <span className="text-xs text-gray-500 truncate">{record.college.name}</span>
                    </div>
                )}

                {/* Output counts */}
                {(record.total_outputs > 0 || record.publications_count > 0 || record.patents_count > 0) && (
                    <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
                        {record.total_outputs > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                <BarChart3 size={11} className="text-indigo-400" />
                                {record.total_outputs} output{record.total_outputs !== 1 ? 's' : ''}
                            </span>
                        )}
                        {record.publications_count > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                <BookOpen size={11} className="text-blue-400" />
                                {record.publications_count} pub{record.publications_count !== 1 ? 's' : ''}
                            </span>
                        )}
                        {record.patents_count > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                <Award size={11} className="text-amber-400" />
                                {record.patents_count} patent{record.patents_count !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}

// ─── Detail slide-over ────────────────────────────────────────────────────────

function DetailPanel({ record, onClose }) {
    const [detail,  setDetail]  = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!record?.id) return;
        setLoading(true);
        get(`/repository/${record.id}`)
            .then(r => setDetail(r.data ?? record))
            .catch(() => setDetail(record))
            .finally(() => setLoading(false));
    }, [record?.id]);

    const d       = detail ?? record;
    const catCls  = CATEGORY_COLORS[d.category] ?? CATEGORY_COLORS.other;
    const catIcon = categories().find(c => c.value === d.category)?.icon ?? FlaskConical;
    const CatIcon = catIcon;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', catCls)}>
                        <CatIcon size={11} />
                        {getCategoryLabel(d.category)}
                    </span>
                    <button onClick={onClose}
                        className="h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <X size={16} className="text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {loading ? (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-6 bg-gray-100 rounded-xl w-3/4" />
                            <div className="h-4 bg-gray-100 rounded-xl w-full" />
                            <div className="h-4 bg-gray-100 rounded-xl w-5/6" />
                            <div className="h-4 bg-gray-100 rounded-xl w-4/5" />
                        </div>
                    ) : (
                        <>
                            {/* Title */}
                            <div>
                                {d.is_featured && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mb-2">
                                        <Star size={10} fill="currentColor" /> Featured Research
                                    </span>
                                )}
                                <h2 className="text-lg font-bold text-gray-900 leading-snug">{d.title}</h2>
                            </div>

                            {/* Metadata grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { icon: Users,     label: 'Principal Investigator', value: d.pi_name },
                                    { icon: Building2, label: 'College',                value: d.college?.name },
                                    { icon: Calendar,  label: 'Academic Year',          value: d.academic_year },
                                    { icon: Globe,     label: 'Category',               value: getCategoryLabel(d.category) },
                                ].map(({ icon: Icon, label, value }) => value ? (
                                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Icon size={11} className="text-gray-400" />
                                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-800">{value}</p>
                                    </div>
                                ) : null)}
                            </div>

                            {/* Abstract */}
                            {d.abstract && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Abstract</h4>
                                    <p className="text-sm text-gray-700 leading-relaxed">{d.abstract}</p>
                                </div>
                            )}

                            {/* Keywords */}
                            {d.keywords && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Keywords</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {String(d.keywords).split(',').map(kw => (
                                            <span key={kw.trim()}
                                                className="flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                                                <Tag size={10} /> {kw.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Research outputs */}
                            {(d.total_outputs > 0 || d.publications_count > 0 || d.patents_count > 0) && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Research Outputs</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { icon: BarChart3, label: 'Total Outputs',  value: d.total_outputs,      color: 'text-indigo-600 bg-indigo-50' },
                                            { icon: BookOpen,  label: 'Publications',   value: d.publications_count, color: 'text-blue-600 bg-blue-50'    },
                                            { icon: Award,     label: 'Patents',        value: d.patents_count,      color: 'text-amber-600 bg-amber-50'  },
                                        ].map(({ icon: Icon, label, value, color }) => (
                                            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                                                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center mx-auto mb-1.5', color)}>
                                                    <Icon size={14} />
                                                </div>
                                                <p className="text-xl font-bold text-gray-900 leading-none">{value ?? 0}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }) {
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl
                            flex items-center justify-center mb-5">
                <FlaskConical size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">
                {hasFilters ? 'No matching research found' : 'Repository is empty'}
            </h3>
            <p className="text-sm text-gray-400 max-w-sm">
                {hasFilters
                    ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                    : 'Published research will appear here once proposals are completed and outputs are recorded.'
                }
            </p>
            {hasFilters && (
                <button onClick={onClear}
                    className="mt-5 flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600
                               bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors">
                    <X size={14} /> Clear all filters
                </button>
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Repository() {
    const appSettings  = usePage().props.app_settings ?? {};
    const primaryColor = appSettings.primary_color || '#4f46e5';
    const orgName      = appSettings.organization_name || 'University';

    const [records,     setRecords]     = useState([]);
    const [meta,        setMeta]        = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [page,        setPage]        = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search,      setSearch]      = useState('');
    const [category,    setCategory]    = useState('');
    const [collegeId,   setCollegeId]   = useState('');
    const [yearFrom,    setYearFrom]    = useState('');
    const [yearTo,      setYearTo]      = useState('');
    const [showAdv,     setShowAdv]     = useState(false);
    const [colleges,    setColleges]    = useState([]);
    const [selected,    setSelected]    = useState(null);

    const searchTimer = useRef(null);

    const load = useCallback(() => {
        setLoading(true);
        const params = {};
        if (search)    params.q           = search;
        if (category)  params.category    = category;
        if (collegeId) params.college_id  = collegeId;
        if (yearFrom)  params.year_from   = yearFrom;
        if (yearTo)    params.year_to     = yearTo;
        params.page = page;

        get('/repository', params)
            .then(r => {
                const paginator = r.data;
                setRecords(paginator?.data ?? []);
                if (paginator?.total != null) {
                    setMeta({
                        current_page: paginator.current_page,
                        last_page:    paginator.last_page,
                        total:        paginator.total,
                        from:         paginator.from ?? 0,
                        to:           paginator.to   ?? 0,
                    });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [search, category, collegeId, yearFrom, yearTo, page]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        get('/colleges/public').then(r => setColleges(r.data ?? [])).catch(() => {});
    }, []);

    const handleSearchInput = (val) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
    };

    const clearAll = () => {
        setSearchInput(''); setSearch(''); setCategory('');
        setCollegeId(''); setYearFrom(''); setYearTo('');
        setPage(1);
    };

    const hasFilters = search || category || collegeId || yearFrom || yearTo;

    return (
        <PublicLayout>
            {/* ── Hero ──────────────────────────────────────────────────── */}
            <section className="py-14 text-white relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, #0f172a 0%, ${primaryColor}cc 60%, #0f172a 100%)` }}>
                {/* Blobs */}
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-10 blur-3xl pointer-events-none"
                    style={{ backgroundColor: primaryColor }} />
                <div className="absolute -bottom-20 left-1/4 h-48 w-48 rounded-full opacity-10 blur-3xl pointer-events-none"
                    style={{ backgroundColor: primaryColor }} />

                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold rounded-full
                                    px-4 py-1.5 bg-white/10 border border-white/20 text-white/80 mb-5">
                        <BookOpen size={12} />
                        {orgName} Research Repository
                    </div>
                    <h1 className="text-4xl font-bold mb-3 tracking-tight">
                        Explore Published Research
                    </h1>
                    <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
                        Discover completed research projects, outputs, and knowledge generated across all colleges.
                    </p>

                    {/* Search */}
                    <div className="relative max-w-2xl mx-auto">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={searchInput}
                            onChange={e => handleSearchInput(e.target.value)}
                            placeholder="Search by title, abstract, keyword, or researcher…"
                            className="w-full pl-12 pr-16 py-4 text-gray-900 rounded-2xl text-sm
                                       bg-white shadow-xl focus:outline-none focus:ring-4 focus:ring-white/30"
                        />
                        {searchInput && (
                            <button onClick={clearAll}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Stats */}
                    {meta && meta.total > 0 && (
                        <p className="text-white/50 text-sm mt-4">
                            {meta.total.toLocaleString()} published research record{meta.total !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
            </section>

            {/* ── Content ───────────────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

                {/* Category tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {categories().map(cat => {
                        const Icon  = cat.icon;
                        const isOn  = category === cat.value;
                        return (
                            <button key={cat.value}
                                onClick={() => { setCategory(cat.value); setPage(1); }}
                                className={cn(
                                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                                    isOn
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-200 hover:text-indigo-700'
                                )}>
                                <Icon size={13} />
                                {cat.label}
                            </button>
                        );
                    })}

                    {/* Advanced filter toggle */}
                    <button onClick={() => setShowAdv(v => !v)}
                        className={cn(
                            'ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                            showAdv
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        )}>
                        <Filter size={13} />
                        Filters
                        {(collegeId || yearFrom || yearTo) && (
                            <span className="h-4 w-4 bg-indigo-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                {[collegeId, yearFrom, yearTo].filter(Boolean).length}
                            </span>
                        )}
                        <ChevronDown size={12} className={cn('transition-transform', showAdv && 'rotate-180')} />
                    </button>
                </div>

                {/* Advanced filters */}
                {showAdv && (
                    <div className="mb-6 bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                        <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">College</label>
                                <select value={collegeId} onChange={e => { setCollegeId(e.target.value); setPage(1); }}
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5
                                               focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                                    <option value="">All Colleges</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Year From</label>
                                <input type="text" placeholder="e.g. 2023-2024" value={yearFrom}
                                    onChange={e => { setYearFrom(e.target.value); setPage(1); }}
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Year To</label>
                                <input type="text" placeholder="e.g. 2025-2026" value={yearTo}
                                    onChange={e => { setYearTo(e.target.value); setPage(1); }}
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                        {(collegeId || yearFrom || yearTo) && (
                            <button onClick={() => { setCollegeId(''); setYearFrom(''); setYearTo(''); setPage(1); }}
                                className="mt-3 text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                                <X size={11} /> Clear advanced filters
                            </button>
                        )}
                    </div>
                )}

                {/* Results count + clear */}
                {(meta || hasFilters) && (
                    <div className="flex items-center justify-between mb-5">
                        <p className="text-sm text-gray-500">
                            {loading ? 'Loading…' : meta
                                ? <><strong className="text-gray-800">{meta.total.toLocaleString()}</strong> result{meta.total !== 1 ? 's' : ''}</>
                                : 'No results'
                            }
                            {hasFilters && <span className="text-gray-400"> (filtered)</span>}
                        </p>
                        {hasFilters && (
                            <button onClick={clearAll}
                                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                                <X size={11} /> Clear all
                            </button>
                        )}
                    </div>
                )}

                {/* Card grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse space-y-3">
                                <div className="h-5 w-28 bg-gray-100 rounded-full" />
                                <div className="h-4 w-full bg-gray-100 rounded-lg" />
                                <div className="h-4 w-4/5 bg-gray-100 rounded-lg" />
                                <div className="h-3 w-full bg-gray-50 rounded" />
                                <div className="h-3 w-5/6 bg-gray-50 rounded" />
                                <div className="h-3 w-2/3 bg-gray-50 rounded" />
                            </div>
                        ))}
                    </div>
                ) : records.length === 0 ? (
                    <div className="grid grid-cols-1">
                        <EmptyState hasFilters={!!hasFilters} onClear={clearAll} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {records.map(r => (
                            <ResearchCard key={r.id} record={r} onClick={setSelected} />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                <Pagination meta={meta} page={page} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </div>

            {/* Detail panel */}
            {selected && (
                <DetailPanel record={selected} onClose={() => setSelected(null)} />
            )}
        </PublicLayout>
    );
}
