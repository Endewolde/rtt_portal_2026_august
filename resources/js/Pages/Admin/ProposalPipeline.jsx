import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Search, ChevronLeft, ChevronRight, X, Download, FileText, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import FilterBar from '../../Components/FilterBar';
import StatusBadge from '../../Components/StatusBadge';
import { get } from '../../lib/api';
import { getStatusLabel, getCategoryLabel, formatDate } from '../../lib/utils';

// 'draft' is deliberately excluded — a draft was never submitted, so it has no
// place in a pipeline built to track submitted proposals (matches the backend,
// which excludes drafts from stage_counts, the list, and the export entirely).
const STAGE_ORDER = [
    'submitted', 'validated', 'under_blind_review', 'blind_review_passed',
    'under_open_defence', 'accepted', 'funded', 'midterm_evaluation', 'completed',
    'rejected', 'archived',
];

const STAGE_COLORS = {
    submitted: { bar: '#3b82f6', soft: '#eff6ff', text: '#1d4ed8' },
    validated: { bar: '#6366f1', soft: '#eef2ff', text: '#4338ca' },
    under_blind_review: { bar: '#f59e0b', soft: '#fffbeb', text: '#b45309' },
    blind_review_passed: { bar: '#f97316', soft: '#fff7ed', text: '#c2410c' },
    under_open_defence: { bar: '#a855f7', soft: '#faf5ff', text: '#7e22ce' },
    accepted: { bar: '#22c55e', soft: '#f0fdf4', text: '#15803d' },
    funded: { bar: '#10b981', soft: '#ecfdf5', text: '#047857' },
    midterm_evaluation: { bar: '#06b6d4', soft: '#ecfeff', text: '#0e7490' },
    completed: { bar: '#059669', soft: '#ecfdf5', text: '#047857' },
    rejected: { bar: '#ef4444', soft: '#fef2f2', text: '#b91c1c' },
    archived: { bar: '#64748b', soft: '#f8fafc', text: '#475569' },
};

const CATEGORY_OPTIONS = ['research', 'community_engagement', 'technology_transfer'];

// ─── Hover detail card ──────────────────────────────────────────────────────────
// `position: fixed` (not absolute-in-table) so it's never clipped by the table's
// own overflow-x-auto scroll container.

function HoverDetailCard({ info }) {
    if (!info) return null;
    const { proposal: p, x, y } = info;
    const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300);

    return (
        <div
            className="fixed z-50 w-72 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-4 pointer-events-none"
            style={{ left, top: y }}
        >
            <p className="font-semibold text-white leading-snug mb-2 line-clamp-3">{p.title || 'Untitled'}</p>
            <div className="space-y-1 text-gray-300">
                <p><span className="text-gray-500">Tracker:</span> {p.tracker_number ?? '—'}</p>
                <p><span className="text-gray-500">PI:</span> {p.pi?.name ?? '—'}</p>
                <p><span className="text-gray-500">College:</span> {p.college?.name ?? '—'}</p>
                <p><span className="text-gray-500">Category:</span> {getCategoryLabel(p.category)}</p>
                <p><span className="text-gray-500">Status:</span> {getStatusLabel(p.status)}</p>
                <p><span className="text-gray-500">Submitted:</span> {p.submitted_at ? formatDate(p.submitted_at) : '—'}</p>
            </div>
        </div>
    );
}

// ─── Sortable column header ─────────────────────────────────────────────────────

const SORT_COLUMNS = [
    { key: 'tracker', label: 'Tracker #', className: 'whitespace-nowrap' },
    { key: 'title', label: 'Title', className: '' },
    { key: 'category', label: 'Category', className: '' },
    { key: 'pi', label: 'PI', className: '' },
    { key: 'college', label: 'College', className: '' },
    { key: 'status', label: 'Status', className: '' },
    { key: 'date', label: 'Submitted', className: 'whitespace-nowrap' },
];

function SortableHeader({ column, sortKey, sortDir, onSort }) {
    const active = sortKey === column.key;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

    return (
        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${column.className}`}>
            <button
                onClick={() => onSort(column.key)}
                className={`flex items-center gap-1 transition-colors ${active ? 'text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
                {column.label}
                <Icon size={11} className={active ? 'opacity-100' : 'opacity-40'} />
            </button>
        </th>
    );
}

// ─── Table (desktop) + card list (mobile) ───────────────────────────────────────

function PipelineTable({ proposals, loading, emptyMessage, sortKey, sortDir, onSort }) {
    const [hoverInfo, setHoverInfo] = useState(null);

    const showHover = (e, proposal) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverInfo({ proposal, x: rect.left, y: rect.bottom + 8 });
    };
    const hideHover = () => setHoverInfo(null);

    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="divide-y divide-gray-100">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="px-4 py-3.5 flex items-center gap-4">
                            {Array.from({ length: 6 }).map((_, j) => (
                                <div key={j} className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: `${12 + j * 4}%` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <FileText size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium text-sm">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop / tablet table */}
            <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-10">#</th>
                                {SORT_COLUMNS.map(col => (
                                    <SortableHeader key={col.key} column={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {proposals.map((p, i) => (
                                <tr key={p.id} className={`transition-colors hover:bg-indigo-50/40 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                    <td className="px-4 py-3 text-xs font-medium text-gray-400 tabular-nums w-10">{i + 1}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <a
                                            href={`/proposals/${p.id}`}
                                            onMouseEnter={e => showHover(e, p)}
                                            onMouseLeave={hideHover}
                                            className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                        >
                                            {p.tracker_number ?? '—'}
                                        </a>
                                    </td>
                                    <td className="px-4 py-3 max-w-xs">
                                        <a
                                            href={`/proposals/${p.id}`}
                                            onMouseEnter={e => showHover(e, p)}
                                            onMouseLeave={hideHover}
                                            className="font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1 block"
                                        >
                                            {p.title || 'Untitled'}
                                        </a>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                                            {getCategoryLabel(p.category)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 font-medium">{p.pi?.name ?? '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{p.college?.name ?? '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                        {p.submitted_at ? formatDate(p.submitted_at) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                    {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} on this page
                </div>
            </div>

            {/* Mobile: stacked cards — every field still visible, no horizontal scrolling */}
            <div className="sm:hidden space-y-3">
                {proposals.map(p => (
                    <a
                        key={p.id}
                        href={`/proposals/${p.id}`}
                        className="block bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded shrink-0">
                                {p.tracker_number ?? '—'}
                            </span>
                            <StatusBadge status={p.status} />
                        </div>
                        <p className="font-medium text-gray-900 text-sm leading-snug mb-2.5">{p.title || 'Untitled'}</p>
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                            <p><span className="text-gray-400">Category:</span> <span className="text-gray-600">{getCategoryLabel(p.category)}</span></p>
                            <p><span className="text-gray-400">PI:</span> <span className="text-gray-600">{p.pi?.name ?? '—'}</span></p>
                            <p><span className="text-gray-400">College:</span> <span className="text-gray-600">{p.college?.name ?? '—'}</span></p>
                            <p><span className="text-gray-400">Submitted:</span> <span className="text-gray-600">{p.submitted_at ? formatDate(p.submitted_at) : '—'}</span></p>
                        </div>
                    </a>
                ))}
            </div>

            <HoverDetailCard info={hoverInfo} />
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalPipeline() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [data, setData] = useState(null);

    const [academicYear, setAcademicYear] = useState('');
    const [collegeId, setCollegeId] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState('updated_at');
    const [sortDir, setSortDir] = useState('desc');

    const filterParams = {
        academic_year: academicYear || undefined,
        college_id: collegeId || undefined,
        category: category || undefined,
        status: status || undefined,
        q: q || undefined,
        sort: sortKey,
        direction: sortDir,
    };

    const load = useCallback((opts = {}) => {
        opts.silent ? setRefreshing(true) : setLoading(true);

        return get('/proposal-pipeline', { ...filterParams, page })
            .then(r => setData(r.data ?? null))
            .catch(() => {})
            .finally(() => { setLoading(false); setRefreshing(false); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [academicYear, collegeId, category, status, q, sortKey, sortDir, page]);

    useEffect(() => { load(); }, [load]);

    // Reset to page 1 whenever a filter (other than page itself) changes.
    useEffect(() => { setPage(1); }, [academicYear, collegeId, category, status, q, sortKey, sortDir]);

    const handleSort = (key) => {
        if (key === sortKey) {
            setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const downloadExcel = async () => {
        setDownloading(true);
        try {
            const token = localStorage.getItem('rtt_token');
            const params = new URLSearchParams(
                Object.fromEntries(Object.entries(filterParams).filter(([, v]) => v))
            );
            const res = await fetch(`/api/v1/proposal-pipeline/export?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proposal_pipeline_${academicYear || data?.academic_year || 'all'}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Export failed. Please try again.');
        }
        setDownloading(false);
    };

    const stageCounts = data?.stage_counts ?? {};
    const proposals = data?.proposals?.data ?? [];
    const pagination = data?.proposals ?? null;
    const activeFilterCount = [collegeId, category, status, q].filter(Boolean).length;

    const toggleStage = (stageKey) => setStatus(prev => (prev === stageKey ? '' : stageKey));

    return (
        <AppLayout breadcrumb="Proposal Pipeline">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-indigo-900 px-6 py-7 text-white">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                <Activity size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Proposal Pipeline</h1>
                                <p className="text-sm text-slate-300 mt-0.5">
                                    Every proposal's current phase for {data?.academic_year ?? 'the selected'} academic year
                                    {data?.total != null && <span className="text-slate-400"> · {data.total} total</span>}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            <select
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                                className="text-sm bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-gray-900"
                            >
                                <option value="">{data?.academic_year ? `Current: ${data.academic_year}` : 'All Years'}</option>
                                {(data?.academic_years ?? []).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => load({ silent: true })}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 disabled:opacity-60 transition-colors"
                            >
                                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                {refreshing ? 'Refreshing…' : 'Refresh'}
                            </button>
                            <button
                                onClick={downloadExcel}
                                disabled={downloading || proposals.length === 0}
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Download size={14} className={downloading ? 'animate-bounce' : ''} />
                                {downloading ? 'Preparing…' : 'Download'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stage pipeline */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-gray-700">Status Breakdown</h2>
                        {status && (
                            <button onClick={() => setStatus('')} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                                <X size={12} /> Clear stage filter
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {loading ? (
                            Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
                            ))
                        ) : (
                            STAGE_ORDER.map(stageKey => {
                                const count = stageCounts[stageKey] ?? 0;
                                const colors = STAGE_COLORS[stageKey];
                                const active = status === stageKey;
                                return (
                                    <button
                                        key={stageKey}
                                        onClick={() => toggleStage(stageKey)}
                                        className={`text-left rounded-2xl border-2 p-3.5 transition-all ${
                                            active ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm'
                                        }`}
                                        style={{
                                            borderColor: active ? colors.bar : '#e5e7eb',
                                            backgroundColor: active ? colors.soft : '#ffffff',
                                        }}
                                    >
                                        <p className="text-2xl font-extrabold tabular-nums" style={{ color: colors.text }}>
                                            {count}
                                        </p>
                                        <p className="text-[11px] font-semibold text-gray-500 mt-0.5 leading-tight">
                                            {getStatusLabel(stageKey)}
                                        </p>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Filters + table */}
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Search tracker # or title…"
                                className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                        </div>

                        <FilterBar accent="indigo" activeCount={activeFilterCount}>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            >
                                <option value="">All Statuses</option>
                                {STAGE_ORDER.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                            </select>
                            {(data?.colleges?.length ?? 0) > 1 && (
                                <select
                                    value={collegeId}
                                    onChange={e => setCollegeId(e.target.value)}
                                    className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                >
                                    <option value="">All Colleges</option>
                                    {data.colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            >
                                <option value="">All Categories</option>
                                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                            </select>
                        </FilterBar>
                    </div>

                    <PipelineTable
                        proposals={proposals}
                        loading={loading}
                        emptyMessage="No proposals match these filters."
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                    />

                    {pagination && pagination.last_page > 1 && (
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs text-gray-400">
                                Page {pagination.current_page} of {pagination.last_page} · {pagination.total} proposals
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={pagination.current_page <= 1}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={13} /> Prev
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                                    disabled={pagination.current_page >= pagination.last_page}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
