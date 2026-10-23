import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import {
    BarChart2, RefreshCw, Sliders, ArrowRight, ArrowLeft, FileSpreadsheet, CheckCircle2, Loader2,
    Search, LineChart as LineIcon, Gauge, Wallet, ShieldAlert, Inbox, History, Link2, Bookmark, X, MousePointerClick,
    RotateCcw, ExternalLink, ChevronDown, Radio,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import InsightsNav from '../../Components/InsightsNav';
import { post, get } from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { formatDateTime, timeAgo, getStatusLabel, getCategoryLabel } from '../../lib/utils';
import { REPORT_META, COLOR_MAP, DownloadExcelButton, renderChart, reportKpis } from '../../Components/Reports/ReportShared';
import { useToast } from '../../Components/Toast';

/** The report library, grouped the way people look for reports. */
const GROUPS = [
    { key: 'proposals', label: 'Proposals', icon: LineIcon, types: ['proposal_count_by_category', 'proposal_count_by_college', 'proposal_trend_by_year', 'approval_rate_by_category', 'review_progress_pipeline'] },
    { key: 'performance', label: 'Performance', icon: Gauge, types: ['college_performance', 'reviewer_workload'] },
    { key: 'finance', label: 'Finance', icon: Wallet, types: ['budget_utilization'] },
    { key: 'quality', label: 'Quality & Service', icon: ShieldAlert, types: ['complaint_summary'] },
];
const ALL_TYPES = GROUPS.flatMap((g) => g.types);
const CATEGORIES = ['research', 'community_engagement', 'technology_transfer'];

/** What clicking a bar or row opens, per report. */
const DRILL_HINT = {
    proposal_count_by_category: 'Click a category to see its proposals',
    proposal_count_by_college: 'Click a college to see its proposals',
    proposal_trend_by_year: 'Click a year to see its proposals',
    approval_rate_by_category: 'Click a category to see its proposals',
    review_progress_pipeline: 'Click a stage to see the proposals in it',
    college_performance: 'Click a college to see its proposals',
    reviewer_workload: "Click a reviewer to open their profile",
    budget_utilization: 'Click a project to open it',
    complaint_summary: 'Click a college to open Complaints',
};

const KPI_TONES = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
};
const KPI_BARS = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', slate: 'bg-slate-400' };

function ReportIcon({ type, size = 'md' }) {
    const meta = REPORT_META[type];
    const colors = COLOR_MAP[meta?.color ?? 'indigo'];
    const Icon = meta?.icon ?? BarChart2;
    const box = size === 'lg' ? 'h-12 w-12 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';
    return (
        <span className={`flex shrink-0 items-center justify-center ${box}`} style={{ backgroundColor: colors.soft }}>
            <Icon size={size === 'lg' ? 22 : size === 'sm' ? 14 : 18} style={{ color: colors.bar }} />
        </span>
    );
}

function LiveDot({ label = 'Live' }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {label}
        </span>
    );
}

/** Filters live in the address bar so any view can be bookmarked or shared. */
function readQuery(url) {
    const q = new URLSearchParams(url.split('?')[1] ?? '');
    return {
        type: q.get('type'),
        filters: { academic_year: q.get('academic_year') ?? '', college_id: q.get('college_id') ?? '', category: q.get('category') ?? '' },
    };
}

function writeQuery(type, filters) {
    const q = new URLSearchParams({ type, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    window.history.replaceState(window.history.state, '', `/reports?${q}`);
}

function useFilterOptions() {
    const [options, setOptions] = useState({ years: [], colleges: [], college_scoped: false, category_scope: null, can_save: false });
    useEffect(() => {
        get('/reports/live-options').then((r) => r.data && setOptions(r.data)).catch(() => {});
    }, []);
    return options;
}

// ─── Drill-down drawer ────────────────────────────────────────────────────────

function DrillDrawer({ drill, onClose }) {
    const [state, setState] = useState({ loading: true, items: [], total: 0 });

    useEffect(() => {
        let alive = true;
        setState({ loading: true, items: [], total: 0 });
        get('/proposals', { ...drill.params, per_page: 50 })
            .then((r) => alive && setState({ loading: false, items: r.data?.data ?? [], total: r.data?.total ?? 0 }))
            .catch(() => alive && setState({ loading: false, items: [], total: 0 }));
        return () => { alive = false; };
    }, [drill]);

    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const listUrl = `/proposals?${new URLSearchParams(drill.params)}`;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} />
            <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Drill-down</p>
                        <h2 className="truncate text-lg font-bold text-gray-900">{drill.title}</h2>
                        <p className="text-xs text-gray-500">{state.loading ? 'Loading…' : `${state.total} proposal${state.total === 1 ? '' : 's'}`}{drill.subtitle ? ` · ${drill.subtitle}` : ''}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {state.loading ? (
                        <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}</div>
                    ) : state.items.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-center">
                            <Inbox size={26} className="text-gray-300" />
                            <p className="mt-2 text-sm text-gray-500">No proposals here.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {state.items.map((p) => (
                                <li key={p.id}>
                                    <Link href={`/proposals/${p.id}`} className="block px-5 py-3 transition hover:bg-slate-50">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-[11px] font-semibold text-slate-500">{p.tracker_number}</span>
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{getStatusLabel(p.status)}</span>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900">{p.title}</p>
                                        <p className="mt-0.5 truncate text-xs text-gray-400">{[p.pi?.name, p.college?.name].filter(Boolean).join(' · ')}</p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="border-t border-gray-100 p-4">
                    <Link href={listUrl} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                        Open in All Proposals <ExternalLink size={14} />
                    </Link>
                </div>
            </aside>
        </div>
    );
}

// ─── Single report (live) ─────────────────────────────────────────────────────

function ReportRail({ current, query }) {
    return (
        <nav className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-4 space-y-5">
                <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
                    <ArrowLeft size={14} /> All reports
                </Link>
                {GROUPS.map((g) => (
                    <div key={g.key}>
                        <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{g.label}</p>
                        <ul className="space-y-0.5">
                            {g.types.map((t) => (
                                <li key={t}>
                                    <Link href={`/reports?type=${t}${query}`}
                                        className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition ${t === current ? 'bg-white font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'}`}>
                                        <ReportIcon type={t} size="sm" />
                                        <span className="truncate">{REPORT_META[t]?.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </nav>
    );
}

function FilterSelect({ value, onChange, children, label }) {
    return (
        <label className="relative min-w-0">
            <span className="sr-only">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className={`w-full appearance-none rounded-xl border bg-white py-2 pl-3 pr-8 text-base sm:text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-200 ${value ? 'border-indigo-300 font-medium text-indigo-700' : 'border-gray-200 text-gray-700'}`}>
                {children}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </label>
    );
}

function KpiStrip({ kpis, loading }) {
    if (!loading && kpis.length === 0) return null;
    return (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {(loading ? [{}, {}, {}, {}] : kpis).map((k, i) => (
                <div key={i} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4">
                    {loading ? (
                        <>
                            <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                            <div className="mt-3 h-7 w-16 animate-pulse rounded bg-gray-100" />
                        </>
                    ) : (
                        <>
                            <span className={`absolute inset-y-0 left-0 w-1 ${KPI_BARS[k.tone] ?? KPI_BARS.slate}`} />
                            <p className="truncate text-xs font-medium text-gray-500">{k.label}</p>
                            <p className="mt-1.5 truncate text-2xl font-bold tabular-nums text-gray-900">{k.value}</p>
                            <p className={`mt-0.5 min-h-4 truncate text-[11px] ${k.hint?.startsWith('▲') ? 'text-emerald-600' : k.hint?.startsWith('▼') ? 'text-red-600' : 'text-gray-400'}`}>{k.hint}</p>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

function SavedVersions({ type, versions, viewing, onView, onLive }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const mine = versions.filter((v) => v.report_type === type && v.status === 'ready');

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen((o) => !o)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${viewing ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                <History size={14} /> <span className="hidden sm:inline">Versions</span>
                {mine.length > 0 && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold tabular-nums text-gray-500">{mine.length}</span>}
            </button>
            {open && (
                <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="border-b border-gray-100 px-4 py-2.5">
                        <p className="text-sm font-semibold text-gray-900">Saved versions</p>
                        <p className="text-[11px] text-gray-400">Figures frozen when saved, for records and comparison.</p>
                    </div>
                    <button onClick={() => { onLive(); setOpen(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50 ${!viewing ? 'bg-emerald-50/50' : ''}`}>
                        <Radio size={15} className="text-emerald-600" />
                        <span className="flex-1 font-medium text-gray-800">Live figures</span>
                        {!viewing && <CheckCircle2 size={14} className="text-emerald-600" />}
                    </button>
                    <ul className="max-h-72 overflow-y-auto border-t border-gray-100">
                        {mine.length === 0 ? (
                            <li className="px-4 py-6 text-center text-xs text-gray-400">No saved versions yet — use “Save version”.</li>
                        ) : mine.map((v) => {
                            const f = v.filters ?? {};
                            const scope = [f.academic_year, f.category && getCategoryLabel(f.category)].filter(Boolean).join(' · ') || 'All data';
                            return (
                                <li key={v.id}>
                                    <button onClick={() => { onView(v); setOpen(false); }}
                                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 ${viewing?.id === v.id ? 'bg-amber-50/60' : ''}`}>
                                        <Bookmark size={14} className="shrink-0 text-gray-400" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm text-gray-800">{formatDateTime(v.completed_at ?? v.created_at)}</span>
                                            <span className="block truncate text-[11px] text-gray-400">{scope}</span>
                                        </span>
                                        {viewing?.id === v.id && <CheckCircle2 size={14} className="text-amber-600" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

function ReportView({ type, initialFilters }) {
    const { error: toastError, success } = useToast();
    const options = useFilterOptions();
    const meta = REPORT_META[type];
    const colors = COLOR_MAP[meta?.color ?? 'indigo'];

    const [filters, setFilters] = useState(initialFilters);
    const [rows, setRows] = useState(null);
    const [generatedAt, setGeneratedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [versions, setVersions] = useState([]);
    const [viewing, setViewing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [drill, setDrill] = useState(null);
    const request = useRef(0);

    const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), [filters]);

    const load = useCallback(async (fresh = false) => {
        const id = ++request.current;
        setLoading(true);
        try {
            const r = await get(`/reports/live/${type}`, { ...params, ...(fresh ? { fresh: 1 } : {}) });
            if (id !== request.current) return;
            setRows(r.data ?? []);
            setGeneratedAt(r.meta?.generated_at ?? null);
        } catch (e) {
            if (id === request.current) toastError(e.response?.data?.message ?? 'Could not load this report.');
        }
        if (id === request.current) setLoading(false);
    }, [type, params]);

    useEffect(() => { load(); writeQuery(type, filters); }, [load]);

    const loadVersions = useCallback(() => get('/reports').then((r) => setVersions(r.data?.data ?? [])).catch(() => {}), []);
    useEffect(() => { loadVersions(); }, [loadVersions]);

    const setFilter = (key, value) => { setViewing(null); setFilters((f) => ({ ...f, [key]: value })); };
    const reset = () => { setViewing(null); setFilters({ academic_year: '', college_id: '', category: '' }); };
    const filtered = Object.values(filters).some(Boolean);

    const saveVersion = async () => {
        setSaving(true);
        try {
            await post('/reports/generate', { type, filters: params });
            success('Version saved — find it under Versions.');
            loadVersions();
        } catch (e) {
            toastError(e.response?.data?.message ?? 'Could not save this version.');
        }
        setSaving(false);
    };

    const exportExcel = async () => {
        setExporting(true);
        try {
            await downloadFile(`/reports/live/${type}/export?${new URLSearchParams(params)}`, `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            toastError(e.response?.data?.message ?? 'Export failed.');
        }
        setExporting(false);
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            success('Link copied — it opens this report with the same filters.');
        } catch {
            toastError('Could not copy the link.');
        }
    };

    /** Clicking a bar or a row: open the proposals behind it, or the record itself. */
    const onDrill = (row) => {
        const base = { ...params };
        const collegeName = (id) => options.colleges.find((c) => String(c.id) === String(id))?.name;
        switch (type) {
            case 'proposal_count_by_category':
            case 'approval_rate_by_category':
                return setDrill({ title: getCategoryLabel(row.category), subtitle: filters.academic_year || 'All years', params: { ...base, category: row.category } });
            case 'proposal_count_by_college':
            case 'college_performance':
                return row.college_id && setDrill({ title: row.college_name, subtitle: filters.academic_year || 'All years', params: { ...base, college_id: row.college_id } });
            case 'proposal_trend_by_year':
                return setDrill({ title: `Academic year ${row.academic_year}`, subtitle: filters.college_id ? collegeName(filters.college_id) : 'All colleges', params: { ...base, academic_year: row.academic_year } });
            case 'review_progress_pipeline':
                return setDrill({ title: getStatusLabel(row.stage), subtitle: filters.academic_year || 'All years', params: { ...base, status: row.stage } });
            case 'budget_utilization':
                return row.proposal_id && router.visit(`/proposals/${row.proposal_id}`);
            case 'reviewer_workload':
                return row.reviewer_id && router.visit(`/admin/users/${row.reviewer_id}`);
            case 'complaint_summary':
                return router.visit('/complaints');
            default:
                return null;
        }
    };

    const shownRows = viewing ? (viewing.result ?? []) : rows;
    const kpis = shownRows ? reportKpis(type, shownRows) : [];
    const query = Object.keys(params).length ? `&${new URLSearchParams(params)}` : '';

    return (
        <div className="flex gap-8">
            <ReportRail current={type} query={query} />

            <div className="min-w-0 flex-1 space-y-5">
                <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 lg:hidden">
                    <ArrowLeft size={14} /> All reports
                </Link>

                {/* Header */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: colors.bar }} />
                    <div className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-start gap-4">
                            <ReportIcon type={type} size="lg" />
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl font-bold text-gray-900">{meta?.label}</h1>
                                    {viewing
                                        ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200"><Bookmark size={11} /> Saved version</span>
                                        : <LiveDot />}
                                </div>
                                <p className="mt-0.5 text-sm text-gray-500">{meta?.desc}</p>
                                <p className="mt-1.5 text-xs text-gray-400">
                                    {viewing ? `Figures as of ${formatDateTime(viewing.completed_at ?? viewing.created_at)}` : generatedAt ? `Updated ${timeAgo(generatedAt)}` : 'Loading…'}
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {!viewing && (
                                <button onClick={() => load(true)} disabled={loading} title="Reload figures"
                                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                                </button>
                            )}
                            <button onClick={copyLink} title="Copy a link to this view"
                                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50">
                                <Link2 size={15} />
                            </button>
                            <SavedVersions type={type} versions={versions} viewing={viewing} onView={setViewing} onLive={() => setViewing(null)} />
                            {viewing ? <DownloadExcelButton snapshot={viewing} /> : (
                                <>
                                    {options.can_save && (
                                        <button onClick={saveVersion} disabled={saving}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />} <span className="hidden sm:inline">Save version</span>
                                        </button>
                                    )}
                                    <button onClick={exportExcel} disabled={exporting || !rows?.length}
                                        className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                                        style={{ backgroundColor: colors.bar }}>
                                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3 sm:flex-row sm:items-center">
                        <div className={`grid flex-1 gap-2 ${options.college_scoped || options.category_scope ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                            {type !== 'proposal_trend_by_year' && (
                                <FilterSelect label="Academic year" value={filters.academic_year} onChange={(v) => setFilter('academic_year', v)}>
                                    <option value="">All academic years</option>
                                    {options.years.map((y) => <option key={y} value={y}>{y}</option>)}
                                </FilterSelect>
                            )}
                            {!options.college_scoped && (
                                <FilterSelect label="College" value={filters.college_id} onChange={(v) => setFilter('college_id', v)}>
                                    <option value="">All colleges</option>
                                    {options.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </FilterSelect>
                            )}
                            {!options.category_scope && (
                                <FilterSelect label="Category" value={filters.category} onChange={(v) => setFilter('category', v)}>
                                    <option value="">All categories</option>
                                    {CATEGORIES.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                                </FilterSelect>
                            )}
                        </div>
                        {filtered && (
                            <button onClick={reset} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-white hover:text-gray-800">
                                <RotateCcw size={13} /> Reset
                            </button>
                        )}
                    </div>
                </div>

                {viewing && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                        <span>You are looking at a saved version from <b>{formatDateTime(viewing.completed_at ?? viewing.created_at)}</b>. Filters and drill-down apply to live figures.</span>
                        <button onClick={() => setViewing(null)} className="inline-flex items-center gap-1.5 self-start rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 sm:self-auto">
                            <Radio size={13} /> Back to live
                        </button>
                    </div>
                )}

                {/* Mobile report switcher */}
                <div className="-mx-5 flex gap-2 overflow-x-auto px-5 lg:hidden [scrollbar-width:none]">
                    {ALL_TYPES.map((t) => (
                        <Link key={t} href={`/reports?type=${t}${query}`}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${t === type ? 'bg-slate-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'}`}>
                            {REPORT_META[t]?.label}
                        </Link>
                    ))}
                </div>

                <KpiStrip kpis={kpis} loading={loading && !rows && !viewing} />

                {/* Chart + table */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
                    {!viewing && rows?.length > 0 && DRILL_HINT[type] && (
                        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700">
                            <MousePointerClick size={12} /> {DRILL_HINT[type]}
                        </p>
                    )}
                    {loading && !rows && !viewing ? (
                        <div className="space-y-4">
                            <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
                            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
                        </div>
                    ) : (
                        <div className={`transition ${loading && !viewing ? 'pointer-events-none opacity-50' : ''}`}>
                            {renderChart(type, shownRows, { onDrill: viewing ? undefined : onDrill })}
                        </div>
                    )}
                </div>
            </div>

            {drill && <DrillDrawer drill={drill} onClose={() => setDrill(null)} />}
        </div>
    );
}

// ─── Library ──────────────────────────────────────────────────────────────────

function ReportCard({ type, savedCount }) {
    const meta = REPORT_META[type];
    const colors = COLOR_MAP[meta?.color ?? 'indigo'];

    return (
        <Link href={`/reports?type=${type}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg">
            <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition group-hover:opacity-70" style={{ backgroundColor: colors.soft }} />
            <div className="relative flex items-start justify-between gap-3">
                <ReportIcon type={type} />
                <LiveDot />
            </div>
            <h3 className="relative mt-4 font-semibold text-gray-900">{meta?.label}</h3>
            <p className="relative mt-1 flex-1 text-sm leading-relaxed text-gray-500">{meta?.desc}</p>
            <div className="relative mt-5 flex items-center justify-between text-xs">
                <span className="text-gray-400">{savedCount ? `${savedCount} saved version${savedCount === 1 ? '' : 's'}` : 'Filter · drill down · export'}</span>
                <span className="inline-flex items-center gap-1 font-semibold transition group-hover:gap-2" style={{ color: colors.bar }}>
                    Open <ArrowRight size={14} />
                </span>
            </div>
        </Link>
    );
}

function LibraryView() {
    const [versions, setVersions] = useState([]);
    const [query, setQuery] = useState('');

    useEffect(() => {
        get('/reports').then((r) => setVersions(r.data?.data ?? [])).catch(() => {});
    }, []);

    const savedByType = useMemo(() => versions.filter((v) => v.status === 'ready').reduce((m, v) => ({ ...m, [v.report_type]: (m[v.report_type] ?? 0) + 1 }), {}), [versions]);

    const term = query.trim().toLowerCase();
    const groups = GROUPS.map((g) => ({
        ...g,
        types: g.types.filter((t) => !term || `${REPORT_META[t]?.label} ${REPORT_META[t]?.desc}`.toLowerCase().includes(term)),
    })).filter((g) => g.types.length > 0);

    const recent = versions.filter((v) => v.status === 'ready').slice(0, 6);

    return (
        <div className="space-y-8">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-indigo-900 px-6 py-8 text-white sm:px-8">
                <span className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" />
                <span className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-200 ring-1 ring-white/15">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            </span>
                            Live data
                        </span>
                        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Reports</h1>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                            Every report opens with today’s figures. Filter by year, college or category, click any bar to see the proposals behind it, and export or save a version when you need a record.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 focus-within:ring-white/40 lg:w-80">
                        <Search size={16} className="shrink-0 text-slate-300" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a report…"
                            className="w-full bg-transparent text-base text-white placeholder:text-slate-400 focus:outline-none sm:text-sm" />
                    </div>
                </div>
            </div>

            {/* Library */}
            {groups.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">No report matches “{query}”.</p>
            ) : groups.map((g) => (
                <section key={g.key}>
                    <div className="mb-3 flex items-center gap-2">
                        <g.icon size={15} className="text-gray-400" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">{g.label}</h2>
                        <span className="h-px flex-1 bg-gray-200" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {g.types.map((t) => <ReportCard key={t} type={t} savedCount={savedByType[t]} />)}
                    </div>
                </section>
            ))}

            {/* Builder + saved versions */}
            <div className="grid gap-4 lg:grid-cols-5">
                <Link href="/reports/builder"
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-sm lg:col-span-2">
                    <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><Sliders size={20} /></span>
                        <p className="mt-4 text-lg font-semibold">Build your own report</p>
                        <p className="mt-1 text-sm text-violet-100">Pick a subject, choose what to group by and measure — for questions the ready-made reports don’t answer.</p>
                    </div>
                    <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition group-hover:gap-2.5">Open Report Builder <ArrowRight size={15} /></span>
                </Link>

                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white lg:col-span-3">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
                        <History size={16} className="text-gray-400" />
                        <h2 className="font-semibold text-gray-900">Saved versions</h2>
                        <span className="text-xs text-gray-400">· frozen figures for your records</span>
                    </div>
                    {recent.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-10 text-center">
                            <Bookmark size={22} className="text-gray-300" />
                            <p className="mt-2 text-sm text-gray-500">Nothing saved yet.</p>
                            <p className="mt-0.5 text-xs text-gray-400">Open a report and use “Save version” to keep today’s figures.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {recent.map((v) => {
                                const f = v.filters ?? {};
                                const scope = [f.academic_year, f.category && getCategoryLabel(f.category)].filter(Boolean).join(' · ') || 'All data';
                                return (
                                    <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                                        <ReportIcon type={v.report_type} size="sm" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-900">{REPORT_META[v.report_type]?.label ?? v.report_type}</p>
                                            <p className="truncate text-xs text-gray-400">{formatDateTime(v.completed_at ?? v.created_at)} · {scope}</p>
                                        </div>
                                        <DownloadExcelButton snapshot={v} className="px-2.5! py-1.5! text-xs!" />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsIndex() {
    const { url } = usePage();
    const { type, filters } = readQuery(url);
    const known = type && ALL_TYPES.includes(type);

    return (
        <AppLayout breadcrumb={known ? REPORT_META[type]?.label : 'Reports'}>
            <InsightsNav />
            <div className="mx-auto max-w-7xl">
                {known ? <ReportView key={type} type={type} initialFilters={filters} /> : <LibraryView />}
            </div>
        </AppLayout>
    );
}
