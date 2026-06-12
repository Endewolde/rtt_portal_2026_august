import { useState, useEffect, useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import {
    Download, FileText, FileSpreadsheet, FileImage,
    Link2, BookOpen, ArrowDownToLine, Search, X, ExternalLink,
    RefreshCw,
} from 'lucide-react';
import PublicLayout from '../../Layouts/PublicLayout';
import { get } from '../../lib/api';

// ─── File-type helpers ────────────────────────────────────────────────────────

function guessType(mimeType, url) {
    if (mimeType) {
        if (mimeType.includes('pdf'))                return 'pdf';
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
        if (mimeType.includes('image'))              return 'image';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    }
    const u = (url ?? '').toLowerCase();
    if (u.endsWith('.pdf'))                          return 'pdf';
    if (u.endsWith('.xlsx') || u.endsWith('.xls') || u.endsWith('.csv')) return 'spreadsheet';
    if (u.endsWith('.doc') || u.endsWith('.docx'))   return 'document';
    if (u.endsWith('.ppt') || u.endsWith('.pptx'))   return 'presentation';
    if (/\.(png|jpg|jpeg|svg|webp)/.test(u))        return 'image';
    return 'link';
}

const TYPE_META = {
    pdf:          { label: 'PDF',          bg: 'bg-red-500',     light: 'bg-red-50 text-red-600 border-red-200',              icon: FileText        },
    spreadsheet:  { label: 'Spreadsheet',  bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-600 border-emerald-200',  icon: FileSpreadsheet },
    document:     { label: 'Document',     bg: 'bg-blue-500',    light: 'bg-blue-50 text-blue-600 border-blue-200',           icon: FileText        },
    presentation: { label: 'Presentation', bg: 'bg-orange-500',  light: 'bg-orange-50 text-orange-600 border-orange-200',    icon: FileText        },
    image:        { label: 'Image',        bg: 'bg-purple-500',  light: 'bg-purple-50 text-purple-600 border-purple-200',    icon: FileImage       },
    link:         { label: 'Link',         bg: 'bg-slate-500',   light: 'bg-slate-50 text-slate-600 border-slate-200',       icon: Link2           },
};

const CATEGORY_META = {
    guideline: { label: 'Guideline', color: '#3b82f6' },
    template:  { label: 'Template',  color: '#8b5cf6' },
    form:      { label: 'Form',      color: '#0d9488' },
    report:    { label: 'Report',    color: '#f59e0b' },
    policy:    { label: 'Policy',    color: '#ef4444' },
    other:     { label: 'Other',     color: '#64748b' },
};

function fmtSize(bytes) {
    if (!bytes) return null;
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Resource card ────────────────────────────────────────────────────────────

function ResourceCard({ resource, primaryColor }) {
    const type    = guessType(resource.file_type, resource.download_url);
    const meta    = TYPE_META[type];
    const catMeta = CATEGORY_META[resource.category] ?? CATEGORY_META.other;
    const Icon    = meta.icon;
    const size    = fmtSize(resource.file_size);

    return (
        <a
            href={resource.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl
                       hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
            {/* Top accent */}
            <div className="h-1 w-full shrink-0"
                style={{ background: `linear-gradient(90deg, ${catMeta.color}, ${catMeta.color}60)` }} />

            <div className="p-6 flex flex-col flex-1">
                {/* Icon + file-type badge */}
                <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${meta.bg} shadow-sm shrink-0`}>
                        <Icon size={22} className="text-white" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.light}`}>
                            {meta.label}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{ color: catMeta.color, borderColor: `${catMeta.color}30`, backgroundColor: `${catMeta.color}10` }}>
                            {catMeta.label}
                        </span>
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-slate-900 leading-snug mb-2
                               group-hover:text-slate-700 transition-colors line-clamp-2">
                    {resource.title}
                </h3>

                {/* Description */}
                {resource.description && (
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 flex-1">
                        {resource.description}
                    </p>
                )}

                <div className="flex-1" />

                {/* File info */}
                {(resource.file_name || size) && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                        <FileText size={11} className="text-gray-300 shrink-0" />
                        <span className="text-[11px] text-gray-400 truncate">{resource.file_name}</span>
                        {size && <span className="text-[11px] text-gray-300 ml-auto shrink-0">{size}</span>}
                    </div>
                )}

                {/* CTA */}
                <div
                    className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                               text-sm font-semibold text-white transition-all duration-200
                               hover:opacity-90 group-hover:shadow-md"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
                >
                    <ArrowDownToLine size={15} />
                    {type === 'link' ? 'Open Link' : 'Download'}
                    <ExternalLink size={12} className="opacity-50" />
                </div>
            </div>
        </a>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DownloadPage() {
    const s            = usePage().props.app_settings ?? {};
    const primaryColor = s.primary_color     || '#6366f1';
    const orgName      = s.organization_name || 'University';
    const systemName   = s.system_name       || 'RTT Platform';

    const [resources, setResources] = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [search,    setSearch]    = useState('');
    const [catFilter, setCatFilter] = useState('all');

    useEffect(() => {
        get('/resources')
            .then(r => setResources(r.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const categories = useMemo(() => {
        const seen = [...new Set(resources.map(r => r.category))];
        return seen.filter(Boolean);
    }, [resources]);

    const filtered = useMemo(() => {
        let list = resources;
        if (catFilter !== 'all') list = list.filter(r => r.category === catFilter);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(r =>
                r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [resources, catFilter, search]);

    return (
        <PublicLayout>

            {/* ── Hero ── */}
            <section className="relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, #0f172a 0%, #0f172a 55%, ${primaryColor}18 100%)` }}>
                <div className="h-px w-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${primaryColor}60, transparent)` }} />

                <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
                    <div className="flex items-center gap-4 mb-5">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)` }}>
                            <Download size={26} className="text-white" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                                {orgName} · {systemName}
                            </p>
                            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                                Downloads
                            </h1>
                        </div>
                    </div>
                    <p className="text-slate-400 text-base leading-relaxed max-w-xl mb-6">
                        Access official templates, guidelines, forms, reports, and policy documents.
                    </p>
                    {!loading && resources.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(CATEGORY_META)
                                .filter(([k]) => categories.includes(k))
                                .map(([k, m]) => {
                                    const count = resources.filter(r => r.category === k).length;
                                    return (
                                        <span key={k}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-white/10 bg-white/5 text-slate-300">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                                            {m.label} ({count})
                                        </span>
                                    );
                                })
                            }
                        </div>
                    )}
                </div>
            </section>

            {/* ── Content ── */}
            <div className="max-w-7xl mx-auto px-6 py-10">

                {loading ? (
                    <div className="flex justify-center py-24">
                        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: `${primaryColor}40`, borderTopColor: 'transparent' }} />
                    </div>
                ) : resources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-28 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-6">
                            <BookOpen size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No resources yet</h3>
                        <p className="text-slate-500 max-w-sm text-sm leading-relaxed">
                            Downloadable resources will appear here once they are published by the administrator.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-3 mb-8">
                            <div className="flex items-center bg-white border border-gray-200 rounded-xl
                                            px-3.5 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-indigo-400
                                            shadow-sm flex-1 min-w-52">
                                <Search size={15} className="text-gray-400 shrink-0" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search resources…"
                                    className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => setCatFilter('all')}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                                        catFilter === 'all'
                                            ? 'text-white border-transparent shadow-sm'
                                            : 'bg-white text-slate-500 border-gray-200 hover:border-gray-300'
                                    }`}
                                    style={catFilter === 'all' ? { backgroundColor: primaryColor } : {}}
                                >
                                    All
                                </button>
                                {categories.map(cat => {
                                    const m     = CATEGORY_META[cat] ?? CATEGORY_META.other;
                                    const active = catFilter === cat;
                                    return (
                                        <button
                                            key={cat}
                                            onClick={() => setCatFilter(cat)}
                                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                                                active
                                                    ? 'text-white border-transparent shadow-sm'
                                                    : 'bg-white text-slate-500 border-gray-200 hover:border-gray-300'
                                            }`}
                                            style={active ? { backgroundColor: m.color } : {}}
                                        >
                                            {m.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Count */}
                        {(search || catFilter !== 'all') && (
                            <p className="text-sm text-slate-500 mb-5">
                                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                                {search && <> for "<strong className="text-slate-700">{search}</strong>"</>}
                            </p>
                        )}

                        {/* Grid */}
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Search size={36} className="text-slate-200 mb-3" />
                                <p className="text-slate-500 font-medium">No resources match your search.</p>
                                <button
                                    onClick={() => { setSearch(''); setCatFilter('all'); }}
                                    className="mt-3 text-sm font-semibold hover:underline"
                                    style={{ color: primaryColor }}
                                >
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filtered.map(resource => (
                                    <ResourceCard key={resource.id} resource={resource} primaryColor={primaryColor} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </PublicLayout>
    );
}
