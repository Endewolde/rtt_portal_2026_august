import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, RefreshCw, Search, ChevronLeft, ChevronRight, Bell, BellRing, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import FilterBar from '../../Components/FilterBar';
import { useToast } from '../../Components/Toast';
import { get, post } from '../../lib/api';
import { formatDate, timeAgo, getCategoryLabel } from '../../lib/utils';
import { programmeKeys } from '../../lib/programmes';


const STATUS_META = {
    overdue: { label: 'Overdue', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    due_today: { label: 'Due Today', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    upcoming: { label: 'Upcoming', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
};

function deadlineStatus(dueDate) {
    if (!dueDate) return 'upcoming';
    const today = new Date().toISOString().slice(0, 10);
    const due = dueDate.slice(0, 10);
    if (due < today) return 'overdue';
    if (due === today) return 'due_today';
    return 'upcoming';
}

function daysOverdue(dueDate) {
    const today = new Date().toISOString().slice(0, 10);
    const diff = Math.round((new Date(today) - new Date(dueDate.slice(0, 10))) / 86400000);
    return diff;
}

function DeadlineBadge({ dueDate }) {
    const status = deadlineStatus(dueDate);
    const meta = STATUS_META[status];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    );
}

function ReminderHistory({ reminders }) {
    if (!reminders || reminders.length === 0) {
        return <span className="text-xs text-gray-400">No reminders sent</span>;
    }
    const last = reminders[0];
    return (
        <span className="text-xs text-gray-600">
            Last: {timeAgo(last.sent_at)} <span className="text-gray-400">({reminders.length} recent)</span>
        </span>
    );
}

const SORT_COLUMNS = [
    { key: 'reviewer', label: 'Reviewer' },
    { key: 'proposal', label: 'Proposal' },
    { key: 'due_date', label: 'Due Date' },
];

function SortableHeader({ column, sortKey, sortDir, onSort }) {
    const active = sortKey === column.key;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

    return (
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
            <button
                onClick={() => onSort(column.key)}
                className={`flex items-center gap-1 transition-colors ${active ? 'text-amber-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
                {column.label}
                <Icon size={11} className={active ? 'opacity-100' : 'opacity-40'} />
            </button>
        </th>
    );
}

function RemindButton({ assignment, onRemind }) {
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const sendingRef = useRef(false); // synchronous guard — React state lags a fast double-click

    const handle = async () => {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        try {
            await onRemind(assignment.id);
            setSent(true);
            setTimeout(() => setSent(false), 4000);
        } catch {
            // onRemind surfaces its own error via alert
        }
        sendingRef.current = false;
        setSending(false);
    };

    return (
        <button
            onClick={handle}
            disabled={sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
            <Bell size={12} className={sending ? 'animate-pulse' : ''} />
            {sent ? 'Sent!' : sending ? 'Sending…' : 'Remind'}
        </button>
    );
}

function DeadlinesTable({ assignments, loading, onRemind, sortKey, sortDir, onSort, selected, onToggle, onToggleAll }) {
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

    if (assignments.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <Clock size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium text-sm">No review assignments match these filters.</p>
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
                            <tr className="bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 w-10 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={assignments.length > 0 && assignments.every(a => selected.has(a.id))}
                                        onChange={e => onToggleAll(assignments, e.target.checked)}
                                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-400"
                                    />
                                </th>
                                {SORT_COLUMNS.map(col => (
                                    <SortableHeader key={col.key} column={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                                ))}
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Overdue</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reminder History</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {assignments.map((a, i) => {
                                const overdue = daysOverdue(a.due_date);
                                return (
                                    <tr key={a.id} className={`transition-colors hover:bg-amber-50/40 ${selected.has(a.id) ? 'bg-amber-50/60' : i % 2 === 0 ? '' : 'bg-gray-50/40'}`}><td className="px-4 py-3 w-10 text-xs font-medium tabular-nums text-gray-400">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(a.id)}
                                                onChange={() => onToggle(a.id)}
                                                className="rounded border-gray-300 text-amber-600 focus:ring-amber-400"
                                            />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <p className="font-medium text-gray-900">{a.reviewer?.name ?? '—'}</p>
                                            <p className="text-xs text-gray-400">{a.reviewer?.email ?? ''}</p>
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <a href={`/proposals/${a.proposal?.id}`} className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                                                {a.proposal?.tracker_number ?? '—'}
                                            </a>
                                            <p className="text-xs text-gray-600 line-clamp-1 mt-1">{a.proposal?.title ?? 'Untitled'}</p>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{formatDate(a.due_date)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                                            {a.evaluation_type?.label ?? a.evaluation_type?.name ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold tabular-nums">
                                            {overdue > 0 ? <span className="text-red-600">{overdue}</span> : <span className="text-gray-400">0</span>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap"><DeadlineBadge dueDate={a.due_date} /></td>
                                        <td className="px-4 py-3 whitespace-nowrap"><ReminderHistory reminders={a.reminders} /></td>
                                        <td className="px-4 py-3 whitespace-nowrap"><RemindButton assignment={a} onRemind={onRemind} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                    {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} on this page
                </div>
            </div>

            {/* Mobile: stacked cards */}
            <div className="sm:hidden space-y-3">
                {assignments.map(a => {
                    const overdue = daysOverdue(a.due_date);
                    return (
                        <div key={a.id} className={`bg-white border rounded-xl p-4 ${selected.has(a.id) ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(a.id)}
                                        onChange={() => onToggle(a.id)}
                                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-400"
                                    />
                                    <p className="font-medium text-gray-900 text-sm">{a.reviewer?.name ?? '—'}</p>
                                </div>
                                <DeadlineBadge dueDate={a.due_date} />
                            </div>
                            <a href={`/proposals/${a.proposal?.id}`} className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-2">
                                {a.proposal?.tracker_number ?? '—'}
                            </a>
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2.5">{a.proposal?.title ?? 'Untitled'}</p>
                            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs mb-3">
                                <p><span className="text-gray-400">Review Type:</span> <span className="text-gray-600">{a.evaluation_type?.label ?? a.evaluation_type?.name ?? '—'}</span></p>
                                <p><span className="text-gray-400">Due:</span> <span className="text-gray-600">{formatDate(a.due_date)}</span></p>
                                <p><span className="text-gray-400">Overdue:</span> <span className={overdue > 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>{Math.max(overdue, 0)} days</span></p>
                                <p><span className="text-gray-400">Reminders:</span> <ReminderHistory reminders={a.reminders} /></p>
                            </div>
                            <RemindButton assignment={a} onRemind={onRemind} />
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export default function ReviewDeadlines() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState(null);

    const [status, setStatus] = useState('');
    const [evaluationTypeId, setEvaluationTypeId] = useState('');
    const [collegeId, setCollegeId] = useState('');
    const [category, setCategory] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState('due_date');
    const [sortDir, setSortDir] = useState('asc');

    const [evaluationTypes, setEvaluationTypes] = useState([]);
    const [selected, setSelected] = useState(() => new Set());
    const [bulkSending, setBulkSending] = useState(false);
    const bulkSendingRef = useRef(false); // synchronous guard — React state lags a fast double-click

    useEffect(() => {
        get('/evaluation-types').then(r => setEvaluationTypes(r.data ?? [])).catch(() => {});
    }, []);

    const filterParams = {
        status: status || undefined,
        evaluation_type_id: evaluationTypeId || undefined,
        college_id: collegeId || undefined,
        category: category || undefined,
        q: q || undefined,
        sort: sortKey,
        direction: sortDir,
    };

    const load = useCallback((opts = {}) => {
        opts.silent ? setRefreshing(true) : setLoading(true);

        return get('/admin/review-deadlines', { ...filterParams, page })
            .then(r => setData(r.data ?? null))
            .catch(() => {})
            .finally(() => { setLoading(false); setRefreshing(false); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, evaluationTypeId, collegeId, category, q, sortKey, sortDir, page]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [status, evaluationTypeId, collegeId, category, q, sortKey, sortDir]);
    useEffect(() => { setSelected(new Set()); }, [status, evaluationTypeId, collegeId, category, q, page]);

    const handleSort = (key) => {
        if (key === sortKey) {
            setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleRemind = async (assignmentId) => {
        try {
            await post(`/review-assignments/${assignmentId}/remind`);
            toast.success('Reminder sent.');
            load({ silent: true });
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Could not send reminder. Please try again.');
            throw e;
        }
    };

    const toggleSelected = (id) => setSelected(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const toggleSelectAll = (rows, checked) => setSelected(prev => {
        const next = new Set(prev);
        rows.forEach(r => (checked ? next.add(r.id) : next.delete(r.id)));
        return next;
    });

    const handleBulkRemind = async () => {
        if (selected.size === 0 || bulkSendingRef.current) return;
        bulkSendingRef.current = true;
        setBulkSending(true);
        try {
            const r = await post('/review-assignments/bulk-remind', { ids: Array.from(selected) });
            const { sent = 0, skipped = 0, out_of_scope = 0 } = r.data ?? {};

            const parts = [`${sent} sent`];
            if (skipped) parts.push(`${skipped} skipped (recently reminded)`);
            if (out_of_scope) parts.push(`${out_of_scope} outside your scope`);
            const summary = parts.join(' · ');

            if (sent > 0 && !skipped && !out_of_scope) {
                toast.success(summary, { title: 'Reminders sent' });
            } else if (sent > 0) {
                toast.warning(summary, { title: 'Reminders sent' });
            } else {
                toast.warning(summary, { title: 'No reminders sent' });
            }

            setSelected(new Set());
            load({ silent: true });
        } catch (e) {
            toast.error(e?.response?.data?.message ?? 'Could not send bulk reminders. Please try again.');
        }
        bulkSendingRef.current = false;
        setBulkSending(false);
    };

    const colleges = data?.colleges ?? [];
    const counts = data?.counts ?? { overdue: 0, due_today: 0, due_this_week: 0 };
    const assignments = data?.assignments?.data ?? [];
    const pagination = data?.assignments ?? null;
    const activeFilterCount = [evaluationTypeId, collegeId, category, q].filter(Boolean).length;

    const toggleStatus = (key) => setStatus(prev => (prev === key ? '' : key));

    return (
        <AppLayout breadcrumb="Review Deadlines">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="rounded-2xl bg-linear-to-r from-slate-900 via-amber-950 to-slate-900 px-6 py-7 text-white">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                <Clock size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Review Deadlines</h1>
                                <p className="text-sm text-slate-300 mt-0.5">
                                    Track overdue and upcoming reviewer assignments, and send reminders
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => load({ silent: true })}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 disabled:opacity-60 transition-colors self-start lg:self-auto"
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Refreshing…' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* Status summary cards */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { key: 'overdue', label: 'Overdue', count: counts.overdue, icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
                        { key: 'due_today', label: 'Due Today', count: counts.due_today, icon: Clock, color: '#b45309', bg: '#fffbeb', border: '#fbbf24' },
                        { key: 'upcoming', label: 'Due This Week', count: counts.due_this_week, icon: Clock, color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
                    ].map(card => {
                        const Icon = card.icon;
                        const active = status === card.key;
                        return (
                            <button
                                key={card.key}
                                onClick={() => toggleStatus(card.key)}
                                className={`text-left rounded-2xl border-2 p-4 transition-all ${active ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm'}`}
                                style={{ borderColor: active ? card.border : '#e5e7eb', backgroundColor: active ? card.bg : '#ffffff' }}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-2xl font-extrabold tabular-nums" style={{ color: card.color }}>{card.count}</p>
                                    <Icon size={16} style={{ color: card.color }} />
                                </div>
                                <p className="text-xs font-semibold text-gray-500">{card.label}</p>
                            </button>
                        );
                    })}
                </div>

                {/* Bulk action bar */}
                {selected.size > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                        <p className="text-sm font-semibold text-amber-800">{selected.size} assignment{selected.size !== 1 ? 's' : ''} selected</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelected(new Set())}
                                className="text-xs font-semibold text-amber-700 hover:text-amber-900"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleBulkRemind}
                                disabled={bulkSending}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <BellRing size={14} className={bulkSending ? 'animate-pulse' : ''} />
                                {bulkSending ? 'Sending…' : `Remind Selected (${selected.size})`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Filters + table */}
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Search reviewer, tracker # or title…"
                                className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            />
                        </div>

                        <FilterBar accent="amber" activeCount={activeFilterCount}>
                            <select
                                value={evaluationTypeId}
                                onChange={e => setEvaluationTypeId(e.target.value)}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                            >
                                <option value="">All Review Types</option>
                                {evaluationTypes.map(t => <option key={t.id} value={t.id}>{t.label ?? t.name}</option>)}
                            </select>
                            {colleges.length > 1 && (
                                <select
                                    value={collegeId}
                                    onChange={e => setCollegeId(e.target.value)}
                                    className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                                >
                                    <option value="">All Colleges</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full sm:w-auto text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                            >
                                <option value="">All Categories</option>
                                {programmeKeys().map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                            </select>
                        </FilterBar>
                    </div>

                    <DeadlinesTable
                        assignments={assignments}
                        loading={loading}
                        onRemind={handleRemind}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        selected={selected}
                        onToggle={toggleSelected}
                        onToggleAll={toggleSelectAll}
                    />

                    {pagination && pagination.last_page > 1 && (
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs text-gray-400">
                                Page {pagination.current_page} of {pagination.last_page} · {pagination.total} assignments
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
