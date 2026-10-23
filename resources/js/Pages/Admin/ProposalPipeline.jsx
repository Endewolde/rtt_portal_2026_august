import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link } from '@inertiajs/react';
import { Activity, Search, ChevronLeft, ChevronRight, X, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Loader2, RotateCcw, Files } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import InsightsNav from '../../Components/InsightsNav';
import StatusBadge from '../../Components/StatusBadge';
import { PageHeader, Select, RefreshButton, Panel, EmptyState, Skeleton } from '../../Components/Insights/Kit';
import { get } from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { getStatusLabel, getCategoryLabel, formatDate } from '../../lib/utils';
import { useToast } from '../../Components/Toast';

// 'draft' is deliberately excluded — a draft was never submitted, so it has no
// place in a pipeline built to track submitted proposals (matches the backend,
// which excludes drafts from stage_counts, the list, and the export entirely).
const FLOW = [
    { label: 'In review', stages: ['submitted', 'validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence', 'accepted'] },
    { label: 'Funded', stages: ['funded', 'midterm_evaluation', 'completed'] },
    { label: 'Closed', stages: ['rejected', 'archived'] },
];
const STAGE_ORDER = FLOW.flatMap((g) => g.stages);

const STAGE_COLORS = {
    submitted: '#3b82f6', validated: '#6366f1', under_blind_review: '#f59e0b', blind_review_passed: '#f97316',
    under_open_defence: '#a855f7', accepted: '#14b8a6', funded: '#10b981', midterm_evaluation: '#06b6d4',
    completed: '#059669', rejected: '#ef4444', archived: '#64748b',
};

const CATEGORY_OPTIONS = ['research', 'community_engagement', 'technology_transfer'];

const SORT_COLUMNS = [
    { key: 'tracker', label: 'Tracker' },
    { key: 'title', label: 'Title' },
    { key: 'pi', label: 'PI' },
    { key: 'college', label: 'College' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Submitted' },
];

function SortableHeader({ column, sortKey, sortDir, onSort }) {
    const active = sortKey === column.key;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
        <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">
            <button onClick={() => onSort(column.key)} className={`inline-flex items-center gap-1 transition ${active ? 'text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}>
                {column.label} <Icon size={11} className={active ? '' : 'opacity-40'} />
            </button>
        </th>
    );
}

/** The stages as one flow: in review → funded → closed. Click a stage to filter the list. */
function StageFlow({ counts, active, onPick, loading }) {
    const total = STAGE_ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0);

    if (loading) return <Skeleton className="h-36 rounded-2xl" />;

    return (
        <div className="grid gap-4 xl:grid-cols-[3fr_1.6fr_1.1fr]">
            {FLOW.map((group) => {
                const groupTotal = group.stages.reduce((s, k) => s + (counts[k] ?? 0), 0);
                return (
                    <div key={group.label} className="rounded-2xl border border-gray-200 bg-white p-3">
                        <div className="mb-2 flex items-baseline justify-between px-1">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{group.label}</p>
                            <p className="text-xs tabular-nums text-gray-500"><span className="font-semibold text-gray-800">{groupTotal}</span>{total > 0 && ` · ${Math.round((groupTotal / total) * 100)}%`}</p>
                        </div>
                        <div className="flex items-stretch gap-1 overflow-x-auto [scrollbar-width:none]">
                            {group.stages.map((key, i) => {
                                const count = counts[key] ?? 0;
                                const on = active === key;
                                return (
                                    <Fragment key={key}>
                                        {i > 0 && <ChevronRight size={14} className="mt-6 shrink-0 text-gray-300" />}
                                        <button onClick={() => onPick(key)}
                                            className={`relative min-w-24 flex-1 overflow-hidden rounded-xl border px-3 pb-3 pt-2.5 text-left transition ${on ? 'border-transparent shadow-md ring-2' : 'border-gray-100 bg-gray-50/60 hover:border-gray-200 hover:bg-white'}`}
                                            style={on ? { '--tw-ring-color': STAGE_COLORS[key], backgroundColor: `${STAGE_COLORS[key]}12` } : undefined}>
                                            <p className="text-2xl font-extrabold tabular-nums text-gray-900">{count}</p>
                                            <p className="mt-0.5 text-[11px] font-medium leading-tight text-gray-500">{getStatusLabel(key)}</p>
                                            <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: STAGE_COLORS[key], opacity: count ? 1 : 0.25 }} />
                                        </button>
                                    </Fragment>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function pageList(current, last) {
    const pages = [...new Set([1, last, current - 1, current, current + 1])].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
    return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? ['…', p] : [p]));
}

export default function ProposalPipeline() {
    const { error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [data, setData] = useState(null);
    const [collegeOptions, setCollegeOptions] = useState([]);

    const [academicYear, setAcademicYear] = useState('');
    const [collegeId, setCollegeId] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [qInput, setQInput] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState('updated_at');
    const [sortDir, setSortDir] = useState('desc');

    // Search waits for a pause in typing.
    useEffect(() => {
        const t = setTimeout(() => setQ(qInput.trim()), 350);
        return () => clearTimeout(t);
    }, [qInput]);

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
            .then((r) => {
                setData(r.data ?? null);
                if ((r.data?.colleges ?? []).length > collegeOptions.length) setCollegeOptions(r.data.colleges);
            })
            .catch(() => {})
            .finally(() => { setLoading(false); setRefreshing(false); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [academicYear, collegeId, category, status, q, sortKey, sortDir, page]);

    useEffect(() => { load({ silent: !!data }); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

    // Back to page 1 whenever a filter (other than page itself) changes.
    useEffect(() => { setPage(1); }, [academicYear, collegeId, category, status, q, sortKey, sortDir]);

    const handleSort = (key) => {
        if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('asc'); }
    };

    const downloadExcel = async () => {
        setDownloading(true);
        try {
            const params = new URLSearchParams(Object.fromEntries(Object.entries(filterParams).filter(([, v]) => v)));
            await downloadFile(`/proposal-pipeline/export?${params}`, `proposal_pipeline_${academicYear || data?.academic_year || 'all'}.xlsx`);
        } catch {
            toastError('Export failed. Please try again.');
        }
        setDownloading(false);
    };

    const stageCounts = data?.stage_counts ?? {};
    const proposals = data?.proposals?.data ?? [];
    const pagination = data?.proposals ?? null;
    const offset = pagination ? (pagination.current_page - 1) * pagination.per_page : 0;
    const filtered = !!(collegeId || category || status || q);
    const clearAll = () => { setCollegeId(''); setCategory(''); setStatus(''); setQInput(''); setQ(''); };

    return (
        <AppLayout breadcrumb="Proposal Pipeline">
            <InsightsNav />
            <div className="mx-auto max-w-7xl space-y-6">
                <PageHeader icon={Activity} color="violet" title="Proposal Pipeline"
                    description={`Every proposal’s current stage · ${data?.academic_year ?? 'selected'} academic year${data?.total != null ? ` · ${data.total} proposals` : ''}`}>
                    <Select label="Academic year" value={academicYear} onChange={setAcademicYear}>
                        <option value="">{data?.academic_year ? `Current (${data.academic_year})` : 'All years'}</option>
                        {(data?.academic_years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
                    </Select>
                    <RefreshButton onClick={() => load({ silent: true })} loading={refreshing} />
                    <button onClick={downloadExcel} disabled={downloading || proposals.length === 0}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
                    </button>
                </PageHeader>

                <StageFlow counts={stageCounts} active={status} onPick={(k) => setStatus((s) => (s === k ? '' : k))} loading={loading && !data} />

                <Panel bodyClassName="">
                    <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 lg:flex-row lg:items-center">
                        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-200">
                            <Search size={15} className="shrink-0 text-gray-400" />
                            <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search tracker number or title…"
                                className="w-full bg-transparent text-base focus:outline-none sm:text-sm" />
                            {qInput && <button onClick={() => setQInput('')} aria-label="Clear search" className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
                            <Select label="Status" value={status} onChange={setStatus}>
                                <option value="">All statuses</option>
                                {STAGE_ORDER.map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                            </Select>
                            {(collegeOptions.length > 1 || collegeId) && (
                                <Select label="College" value={collegeId} onChange={setCollegeId}>
                                    <option value="">All colleges</option>
                                    {collegeOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            )}
                            <Select label="Category" value={category} onChange={setCategory}>
                                <option value="">All categories</option>
                                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                            </Select>
                        </div>
                        {filtered && (
                            <button onClick={clearAll} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800">
                                <RotateCcw size={13} /> Reset
                            </button>
                        )}
                    </div>

                    {loading && !data ? (
                        <div className="space-y-2 p-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
                    ) : proposals.length === 0 ? (
                        <EmptyState icon={Files} title="No proposals match these filters">
                            {filtered && <button onClick={clearAll} className="mt-4 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Clear filters</button>}
                        </EmptyState>
                    ) : (
                        <div className={`transition ${refreshing ? 'opacity-60' : ''}`}>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/80">
                                            <th className="w-12 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">#</th>
                                            {SORT_COLUMNS.map((col) => <SortableHeader key={col.key} column={col} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {proposals.map((p, i) => (
                                            <tr key={p.id} className="group transition-colors hover:bg-indigo-50/30">
                                                <td className="px-4 py-3 text-xs tabular-nums text-gray-400">{offset + i + 1}</td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-500">{p.tracker_number ?? '—'}</td>
                                                <td className="max-w-sm px-4 py-3">
                                                    <Link href={`/proposals/${p.id}`} className="line-clamp-1 font-medium text-gray-900 group-hover:text-indigo-700" title={p.title}>{p.title || 'Untitled'}</Link>
                                                    <span className="text-[11px] text-gray-400">{getCategoryLabel(p.category)}</span>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{p.pi?.name ?? '—'}</td>
                                                <td className="max-w-48 truncate px-4 py-3 text-gray-600">{p.college?.name ?? '—'}</td>
                                                <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={p.status} /></td>
                                                <td className="whitespace-nowrap px-4 py-3 text-gray-500">{p.submitted_at ? formatDate(p.submitted_at) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <ul className="divide-y divide-gray-100 md:hidden">
                                {proposals.map((p) => (
                                    <li key={p.id}>
                                        <Link href={`/proposals/${p.id}`} className="block px-4 py-3.5 active:bg-gray-50">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-mono text-[11px] font-semibold text-slate-500">{p.tracker_number ?? '—'}</span>
                                                <StatusBadge status={p.status} />
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-gray-900">{p.title || 'Untitled'}</p>
                                            <p className="mt-1 truncate text-xs text-gray-500">{[p.pi?.name, p.college?.name, p.submitted_at && formatDate(p.submitted_at)].filter(Boolean).join(' · ')}</p>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {pagination && pagination.total > 0 && (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row">
                            <p className="text-xs text-gray-500">Showing <span className="font-semibold text-gray-700">{offset + 1}–{offset + proposals.length}</span> of <span className="font-semibold text-gray-700">{pagination.total}</span></p>
                            {pagination.last_page > 1 && (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.current_page <= 1} aria-label="Previous page"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
                                    {pageList(pagination.current_page, pagination.last_page).map((p, i) => p === '…'
                                        ? <span key={`g${i}`} className="px-1 text-xs text-gray-400">…</span>
                                        : <button key={p} onClick={() => setPage(p)} className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold tabular-nums ${p === pagination.current_page ? 'bg-slate-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>)}
                                    <button onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))} disabled={pagination.current_page >= pagination.last_page} aria-label="Next page"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={15} /></button>
                                </div>
                            )}
                        </div>
                    )}
                </Panel>
            </div>
        </AppLayout>
    );
}
