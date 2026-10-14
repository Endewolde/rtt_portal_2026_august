import { useState, useEffect, useCallback } from 'react';
import { Mail, MailCheck, MailX, Search, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { get } from '../lib/api';

const STATUS_FILTERS = [
    { key: '', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'failed', label: 'Failed' },
];

function formatTime(iso) {
    return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

function Stat({ icon: Icon, label, value, tone }) {
    const tones = {
        green: 'bg-emerald-50 text-emerald-600',
        red: 'bg-red-50 text-red-600',
        gray: 'bg-gray-100 text-gray-600',
    };
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={18} /></span>
            <span>
                <span className="block text-2xl font-bold leading-none text-gray-900 tabular-nums">{value}</span>
                <span className="mt-1 block text-xs font-medium text-gray-500">{label}</span>
            </span>
        </div>
    );
}

/** System Monitor → Email: delivery log of every outgoing email. */
export default function EmailLogPanel() {
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await get('/system-monitor/email-log', { status, search, page });
            setData(res.data);
            setStats(res.meta?.stats ?? null);
        } catch { /* handled by empty state */ }
        setLoading(false);
    }, [status, search, page]);

    useEffect(() => {
        const t = setTimeout(load, search ? 350 : 0);
        return () => clearTimeout(t);
    }, [load, search]);

    const rows = data?.data ?? [];
    const failureRate = stats && (stats.sent_7d + stats.failed_7d) > 0
        ? Math.round((stats.failed_7d / (stats.sent_7d + stats.failed_7d)) * 100)
        : 0;

    return (
        <div className="space-y-4">
            {stats && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Stat icon={MailCheck} label="Sent (24h)" value={stats.sent_24h} tone="green" />
                    <Stat icon={MailX} label="Failed (24h)" value={stats.failed_24h} tone={stats.failed_24h > 0 ? 'red' : 'gray'} />
                    <Stat icon={Mail} label="Sent (7 days)" value={stats.sent_7d} tone="gray" />
                    <Stat icon={AlertTriangle} label="Failure rate (7 days)" value={`${failureRate}%`} tone={failureRate > 5 ? 'red' : 'gray'} />
                </div>
            )}

            {stats?.last_failure && stats.failed_24h > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>
                        <strong>Emails are failing.</strong> Last failure {formatTime(stats.last_failure.created_at)}
                        {stats.last_failure.source && <> ({stats.last_failure.source})</>}: {stats.last_failure.error}
                    </span>
                </div>
            )}

            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => { setStatus(f.key); setPage(1); }}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${status === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-1 items-center rounded-xl border border-gray-200 px-3 focus-within:ring-2 focus-within:ring-blue-400">
                    <Search size={15} className="text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search recipient, subject or type…"
                        className="w-full bg-transparent px-2.5 py-2 text-sm outline-none"
                    />
                </div>
                <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {loading && !data ? (
                    <div className="space-y-2 p-4 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100" />)}</div>
                ) : rows.length === 0 ? (
                    <div className="py-14 text-center">
                        <Mail size={28} className="mx-auto text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">No emails logged{status ? ` with status "${status}"` : ''} yet.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {rows.map((r) => (
                            <li key={r.id} className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {r.status === 'failed' ? 'Failed' : 'Sent'}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-gray-900">{r.subject ?? '(no subject)'}</p>
                                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                                            <span>{r.to_email}</span>
                                            {r.source && <span className="font-mono text-gray-400">{r.source}</span>}
                                            <span>{formatTime(r.created_at)}</span>
                                        </p>
                                        {r.error && expanded === r.id && (
                                            <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-red-50 p-2.5 text-xs text-red-800">{r.error}</pre>
                                        )}
                                    </div>
                                    {r.error && (
                                        <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="shrink-0 text-xs font-medium text-red-600 hover:underline">
                                            {expanded === r.id ? <ChevronUp size={14} /> : <span className="inline-flex items-center gap-0.5">Error <ChevronDown size={14} /></span>}
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {data && data.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 text-sm text-gray-600">
                        <span>Page {data.current_page} of {data.last_page} · {data.total} emails</span>
                        <span className="flex gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40">Previous</button>
                            <button disabled={page >= data.last_page} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40">Next</button>
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
