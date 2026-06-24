import { useState, useEffect, useCallback, useRef } from 'react';
import {
    FolderSearch, Search, ChevronDown, Download, FileText,
    Users, Building2, GraduationCap, User, Mail, Tag,
    Calendar, BookOpen, X, ChevronLeft, ChevronRight,
    Loader2, Filter, SlidersHorizontal,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';

// ─── Static data ───────────────────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'research',             label: 'Research'             },
    { value: 'community_engagement', label: 'Community Engagement' },
    { value: 'technology_transfer',  label: 'Technology Transfer'  },
    { value: 'innovation',           label: 'Innovation'           },
    { value: 'other',                label: 'Other'                },
];

const ACADEMIC_YEARS = Array.from({ length: 60 }, (_, i) => {
    const s = 2059 - i;
    return { value: `${s}-${s + 1}`, label: `${s}–${s + 1}` };
});

const STATUS_STYLES = {
    submitted:    { label: 'Submitted',    bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
    validated:    { label: 'Validated',    bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500'    },
    accepted:     { label: 'Accepted',     bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
    funded:       { label: 'Funded',       bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    completed:    { label: 'Completed',    bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500'   },
    rejected:     { label: 'Rejected',     bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500'     },
    under_review: { label: 'Under Review', bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
};

const CAT_STYLES = {
    research:             { bg: 'bg-blue-50',    text: 'text-blue-700',   border: '#3b82f6' },
    community_engagement: { bg: 'bg-emerald-50', text: 'text-emerald-700',border: '#10b981' },
    technology_transfer:  { bg: 'bg-violet-50',  text: 'text-violet-700', border: '#8b5cf6' },
    innovation:           { bg: 'bg-amber-50',   text: 'text-amber-700',  border: '#f59e0b' },
    other:                { bg: 'bg-gray-50',    text: 'text-gray-600',   border: '#94a3b8' },
};

const AV_COLORS = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtSize = b => { if (!b) return ''; if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`; return `${(b / 1048576).toFixed(1)} MB`; };
const initials = n => (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const avBg     = n => AV_COLORS[(n || '').charCodeAt(0) % AV_COLORS.length];
const catStyle = cat => CAT_STYLES[cat] ?? CAT_STYLES.other;

// ─── Atoms ─────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 8, text = 'text-xs' }) {
    return (
        <div className={`w-${size} h-${size} rounded-full ${avBg(name)} flex items-center justify-center shrink-0`}>
            <span className={`${text} font-bold text-white leading-none`}>{initials(name)}</span>
        </div>
    );
}

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] ?? { label: fmt(status), bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
            {s.label}
        </span>
    );
}

function CategoryBadge({ cat }) {
    const s = catStyle(cat);
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
            {fmt(cat)}
        </span>
    );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
    return (
        <div className="space-y-2.5 animate-pulse">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 border-l-4 border-l-gray-200 p-5">
                    <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                            <div className="flex gap-2">
                                <div className="h-5 w-16 rounded-full bg-gray-100" />
                                <div className="h-5 w-20 rounded-full bg-gray-100" />
                                <div className="h-5 w-14 rounded-full bg-gray-100" />
                            </div>
                            <div className="h-4 w-2/3 rounded bg-gray-100" />
                            <div className="flex gap-4">
                                <div className="h-3 w-24 rounded bg-gray-50" />
                                <div className="h-3 w-32 rounded bg-gray-50" />
                            </div>
                        </div>
                        <div className="h-7 w-7 rounded-lg bg-gray-100 shrink-0" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Detail tabs ───────────────────────────────────────────────────────────────

function DetailPanel({ proposal, onDownload, downloading }) {
    const [tab, setTab] = useState('overview');

    const TABS = [
        { id: 'overview',  label: 'Overview',  icon: BookOpen, badge: null },
        { id: 'team',      label: 'Team',       icon: Users,    badge: proposal.members?.length ?? 0 },
        { id: 'documents', label: 'Documents',  icon: FileText, badge: proposal.documents?.length ?? 0 },
    ];

    return (
        <div className="border-t border-gray-100">
            {/* Tab strip */}
            <div className="flex gap-px px-6 pt-3 bg-gray-50/70">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all
                            ${tab === t.id
                                ? 'bg-white text-indigo-700 border border-b-transparent border-gray-200 shadow-xs'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/60'}`}>
                        <t.icon size={11} />
                        {t.label}
                        {t.badge != null && (
                            <span className={`text-[9px] px-1.5 py-px rounded-full font-bold
                                ${tab === t.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                                {t.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="px-6 py-5 bg-gray-50/40">

                {/* Overview */}
                {tab === 'overview' && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-100 shadow-xs">
                            <Avatar name={proposal.pi_name} size={10} text="text-sm" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-800">{proposal.pi_name}</div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                                    <Mail size={10} className="shrink-0 text-gray-400" />{proposal.pi_email}
                                </div>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                                <div className="flex items-center gap-1 text-xs text-gray-600 justify-end">
                                    <Building2 size={10} className="text-gray-400" />{proposal.college_name}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-400 justify-end">
                                    <GraduationCap size={10} />{proposal.department_name}
                                </div>
                            </div>
                        </div>

                        {proposal.abstract && (
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Abstract</p>
                                <p className="text-sm text-gray-600 leading-relaxed">{proposal.abstract}</p>
                            </div>
                        )}

                        {proposal.keywords && (
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Keywords</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {proposal.keywords.split(/[,;]+/).filter(k => k.trim()).map((k, i) => (
                                        <span key={i} className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs text-gray-600">
                                            {k.trim()}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Team */}
                {tab === 'team' && (
                    proposal.members?.length === 0 ? (
                        <div className="flex flex-col items-center py-8 text-gray-300">
                            <Users size={24} className="mb-2" />
                            <p className="text-sm">No additional team members</p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-2.5">
                            {proposal.members?.map((m, i) => (
                                <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-gray-100 shadow-xs hover:border-indigo-200 transition-colors">
                                    <Avatar name={m.name} size={9} text="text-xs" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-800 truncate">{m.name}</div>
                                        <div className="text-xs text-gray-400 truncate">{m.email}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                                            {fmt(m.role)}
                                        </span>
                                        {m.contribution_percentage > 0 && (
                                            <div className="text-[10px] text-gray-400 mt-1">{m.contribution_percentage}%</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* Documents */}
                {tab === 'documents' && (
                    proposal.documents?.length === 0 ? (
                        <div className="flex flex-col items-center py-8 text-gray-300">
                            <FileText size={24} className="mb-2" />
                            <p className="text-sm">No documents uploaded</p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-2.5">
                            {proposal.documents?.map((d, i) => {
                                const busy = downloading === d.id;
                                return (
                                    <div key={i} className="flex flex-col gap-3 p-4 rounded-xl bg-white border border-gray-100 shadow-xs hover:border-blue-200 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                                <FileText size={14} className="text-blue-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-800 leading-snug break-all">{d.original_filename}</div>
                                                <div className="text-[11px] text-gray-400 mt-0.5">{fmt(d.document_type)}{d.file_size ? ` · ${fmtSize(d.file_size)}` : ''}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => onDownload(d)} disabled={busy}
                                            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold border border-blue-100 hover:border-blue-200 transition-all disabled:opacity-40 active:scale-95">
                                            {busy
                                                ? <><Loader2 size={11} className="animate-spin" /> Downloading…</>
                                                : <><Download size={11} /> Download</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

// ─── Proposal card ─────────────────────────────────────────────────────────────

function ProposalCard({ proposal, expanded, onToggle, onDownload, downloading }) {
    const cs = catStyle(proposal.category);

    return (
        <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 overflow-hidden transition-all duration-150 shadow-xs
            ${expanded ? 'shadow-md border-gray-200' : 'hover:shadow-sm hover:border-gray-200'}`}
            style={{ borderLeftColor: cs.border }}>

            <button onClick={onToggle} className="w-full text-left group px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        {/* Tags row */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <span className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                                {proposal.tracker_number}
                            </span>
                            <CategoryBadge cat={proposal.category} />
                            <StatusBadge status={proposal.status} />
                            <span className="text-[11px] text-gray-400">{proposal.academic_year}</span>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-bold text-gray-800 leading-snug group-hover:text-indigo-700 transition-colors">
                            {proposal.title}
                        </h3>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5">
                            <span className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                                <User size={11} className="text-gray-400 shrink-0" />{proposal.pi_name}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Building2 size={11} className="text-gray-400 shrink-0" />{proposal.college_name}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                <GraduationCap size={11} className="shrink-0" />{proposal.department_name}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                <Calendar size={11} className="shrink-0" />{fmtDate(proposal.submitted_at)}
                            </span>
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className={`p-1.5 rounded-lg transition-colors
                            ${expanded
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'text-gray-300 group-hover:text-gray-500 group-hover:bg-gray-50'}`}>
                            <ChevronDown size={15} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1" title="Members">
                                <Users size={11} />{proposal.members?.length ?? 0}
                            </span>
                            <span className="flex items-center gap-1" title="Documents">
                                <FileText size={11} />{proposal.documents?.length ?? 0}
                            </span>
                        </div>
                    </div>
                </div>
            </button>

            {expanded && (
                <DetailPanel
                    proposal={proposal}
                    onDownload={onDownload}
                    downloading={downloading}
                />
            )}
        </div>
    );
}

// ─── Pagination ────────────────────────────────────────────────────────────────

function Pager({ current, last, onChange }) {
    if (last <= 1) return null;
    const pages = [];
    for (let i = 1; i <= last; i++) {
        if (i === 1 || i === last || (i >= current - 2 && i <= current + 2)) pages.push(i);
        else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    const navBtn = 'flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs';
    return (
        <div className="flex items-center justify-center gap-1.5 pt-5">
            <button onClick={() => onChange(current - 1)} disabled={current === 1} className={navBtn}>
                <ChevronLeft size={13} /> Prev
            </button>
            {pages.map((p, i) =>
                p === '…'
                    ? <span key={`el${i}`} className="px-1 text-gray-300 text-xs">…</span>
                    : (
                        <button key={p} onClick={() => onChange(p)}
                            className={`w-8 h-8 rounded-xl text-xs font-semibold transition-all
                                ${p === current
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-xs'}`}>
                            {p}
                        </button>
                    )
            )}
            <button onClick={() => onChange(current + 1)} disabled={current === last} className={navBtn}>
                Next <ChevronRight size={13} />
            </button>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const EMPTY = { academic_year: '', category: '', college_id: '', search: '' };

export default function ProposalArchive() {
    const [filters, setFilters]         = useState(EMPTY);
    const [colleges, setColleges]       = useState([]);
    const [page, setPage]               = useState(1);
    const [data, setData]               = useState(null);
    const [loading, setLoading]         = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [expanded, setExpanded]       = useState(null);
    const [downloading, setDownloading] = useState(null);
    const [activeFilters, setActiveFilters] = useState(EMPTY);

    // Load colleges once
    useEffect(() => {
        get('/colleges')
            .then(r => {
                const list = (r.data ?? []).map(c => ({ value: String(c.id), label: c.name }));
                setColleges(list);
            })
            .catch(() => {});
    }, []);

    const load = useCallback(async (f, p) => {
        setLoading(true);
        try {
            const q = new URLSearchParams({ page: p });
            if (f.academic_year) q.set('academic_year', f.academic_year);
            if (f.category)      q.set('category', f.category);
            if (f.college_id)    q.set('college_id', f.college_id);
            if (f.search)        q.set('search', f.search);
            const r = await get(`/proposal-archive?${q}`);
            setData(r.data ?? null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Only load when a search has been triggered
    useEffect(() => {
        if (hasSearched) { load(activeFilters, page); }
    }, [activeFilters, page, hasSearched, load]);

    const handleSearch = () => {
        setActiveFilters({ ...filters });
        setPage(1);
        setExpanded(null);
        setHasSearched(true);
    };

    const clearFilter = (key) => {
        const next = { ...filters, [key]: '' };
        setFilters(next);
        setActiveFilters(next);
        setPage(1);
        setExpanded(null);
    };

    const clearAll = () => {
        setFilters(EMPTY);
        setActiveFilters(EMPTY);
        setPage(1);
        setExpanded(null);
        setData(null);
        setHasSearched(false);
    };

    const gotoPage = (p) => {
        setPage(p);
        setExpanded(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const downloadDoc = async (doc) => {
        setDownloading(doc.id);
        try {
            const token = localStorage.getItem('rtt_token');
            const res   = await fetch(`/api/v1/proposal-archive/documents/${doc.id}/download`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(res.status);
            const blob = await res.blob();
            const a    = document.createElement('a');
            a.href     = URL.createObjectURL(blob);
            a.download = doc.original_filename;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (e) {
            console.error('Download failed:', e);
        } finally {
            setDownloading(null);
        }
    };

    // Active chip labels
    const chips = [
        activeFilters.academic_year && { key: 'academic_year', icon: Calendar, label: ACADEMIC_YEARS.find(a => a.value === activeFilters.academic_year)?.label },
        activeFilters.category      && { key: 'category',      icon: Tag,      label: CATEGORIES.find(c => c.value === activeFilters.category)?.label },
        activeFilters.college_id    && { key: 'college_id',    icon: Building2,label: colleges.find(c => c.value === activeFilters.college_id)?.label },
        activeFilters.search        && { key: 'search',        icon: Search,   label: `"${activeFilters.search}"` },
    ].filter(Boolean);

    const from = data ? ((data.current_page - 1) * data.per_page) + 1 : 0;
    const to   = data ? Math.min(data.current_page * data.per_page, data.total) : 0;

    const selCls = (active) =>
        `relative flex items-center gap-2 rounded-xl px-3 py-2 border text-sm transition-all cursor-pointer
         ${active
             ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
             : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/40 shadow-xs'}`;

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto space-y-4">

                {/* ── Header ───────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                            <FolderSearch size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-800">Proposal Archive</h1>
                            <p className="text-xs text-gray-400">
                                Search and browse submitted proposals with full details
                            </p>
                        </div>
                    </div>
                    {data && hasSearched && (
                        <div className="text-right">
                            <span className="text-2xl font-bold text-gray-800 tabular-nums">{data.total.toLocaleString()}</span>
                            <p className="text-xs text-gray-400">{chips.length ? 'matched' : 'proposals'}</p>
                        </div>
                    )}
                </div>

                {/* ── Filter panel ─────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        <SlidersHorizontal size={11} /> Filters
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {/* Academic year */}
                        <div className={selCls(!!filters.academic_year)}>
                            <Calendar size={13} className={filters.academic_year ? 'text-indigo-500' : 'text-gray-400'} />
                            <select value={filters.academic_year}
                                onChange={e => setFilters(f => ({ ...f, academic_year: e.target.value }))}
                                className="bg-transparent focus:outline-none appearance-none pr-5 min-w-36 text-inherit cursor-pointer">
                                <option value="">All Academic Years</option>
                                {ACADEMIC_YEARS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={11} className="absolute right-2.5 pointer-events-none text-gray-400" />
                        </div>

                        {/* Category */}
                        <div className={selCls(!!filters.category)}>
                            <Tag size={13} className={filters.category ? 'text-indigo-500' : 'text-gray-400'} />
                            <select value={filters.category}
                                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                                className="bg-transparent focus:outline-none appearance-none pr-5 min-w-36 text-inherit cursor-pointer">
                                <option value="">All Categories</option>
                                {CATEGORIES.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={11} className="absolute right-2.5 pointer-events-none text-gray-400" />
                        </div>

                        {/* College */}
                        <div className={selCls(!!filters.college_id)}>
                            <Building2 size={13} className={filters.college_id ? 'text-indigo-500' : 'text-gray-400'} />
                            <select value={filters.college_id}
                                onChange={e => setFilters(f => ({ ...f, college_id: e.target.value }))}
                                className="bg-transparent focus:outline-none appearance-none pr-5 min-w-36 text-inherit cursor-pointer">
                                <option value="">All Colleges</option>
                                {colleges.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={11} className="absolute right-2.5 pointer-events-none text-gray-400" />
                        </div>

                        {/* Search */}
                        <div className={`relative flex items-center gap-2 rounded-xl px-3 py-2 border flex-1 min-w-52 bg-white shadow-xs transition-all
                            ${filters.search ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 focus-within:border-indigo-200 focus-within:bg-indigo-50/20'}`}>
                            <Search size={13} className={filters.search ? 'text-indigo-400 shrink-0' : 'text-gray-400 shrink-0'} />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Title, tracker number, or PI name…"
                                className="bg-transparent text-sm text-gray-700 placeholder-gray-300 focus:outline-none w-full"
                            />
                            {filters.search && (
                                <button onClick={() => setFilters(f => ({ ...f, search: '' }))}
                                    className="text-gray-300 hover:text-gray-500 transition-colors shrink-0">
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Search button */}
                        <button onClick={handleSearch}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-sm active:scale-95 shrink-0">
                            <Search size={13} /> Search
                        </button>
                    </div>

                    {/* Active chips */}
                    {chips.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active:</span>
                            {chips.map(chip => (
                                <button key={chip.key} onClick={() => clearFilter(chip.key)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium border border-indigo-100 hover:bg-indigo-100 transition-all">
                                    <chip.icon size={9} />{chip.label}<X size={8} className="ml-0.5 opacity-60" />
                                </button>
                            ))}
                            <button onClick={clearAll}
                                className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors ml-1 underline underline-offset-2">
                                Clear all
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Prompt state (before first search) ──────────────── */}
                {!hasSearched && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                            <FolderSearch size={26} className="text-indigo-400" />
                        </div>
                        <p className="text-sm font-semibold text-gray-500">Use the filters above to search proposals</p>
                        <p className="text-xs text-gray-300 mt-1">
                            Filter by academic year, category, college, or search by title / PI name
                        </p>
                    </div>
                )}

                {/* ── Loading ──────────────────────────────────────────── */}
                {loading && <Skeleton />}

                {/* ── Empty ────────────────────────────────────────────── */}
                {!loading && hasSearched && data?.items.length === 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                            <Search size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm font-semibold text-gray-400">No proposals match your filters</p>
                        <p className="text-xs text-gray-300 mt-1 mb-4">Try different filters or clear them to broaden results</p>
                        <button onClick={clearAll}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-sm hover:bg-gray-100 hover:text-gray-800 transition-all">
                            <X size={13} /> Clear filters
                        </button>
                    </div>
                )}

                {/* ── Results ──────────────────────────────────────────── */}
                {!loading && hasSearched && data && data.items.length > 0 && (
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs text-gray-400 tabular-nums">
                                Showing {from}–{to} of <span className="font-semibold text-gray-600">{data.total.toLocaleString()}</span> proposals
                            </span>
                            {expanded && (
                                <button onClick={() => setExpanded(null)}
                                    className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors font-medium">
                                    Collapse all
                                </button>
                            )}
                        </div>

                        {data.items.map(p => (
                            <ProposalCard
                                key={p.id}
                                proposal={p}
                                expanded={expanded === p.id}
                                onToggle={() => setExpanded(prev => prev === p.id ? null : p.id)}
                                onDownload={downloadDoc}
                                downloading={downloading}
                            />
                        ))}

                        <Pager current={data.current_page} last={data.last_page} onChange={gotoPage} />
                    </div>
                )}

            </div>
        </AppLayout>
    );
}
