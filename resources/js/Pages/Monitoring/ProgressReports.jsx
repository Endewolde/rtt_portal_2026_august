import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { ClipboardList, Send, AlertCircle, Clock, RefreshCw, Inbox } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get } from '../../lib/api';
import { formatDate } from '../../lib/utils';

const SECTIONS = [
    { key: 'awaiting_review', label: 'Awaiting your review', icon: Send, tone: 'text-blue-700 bg-blue-50 border-blue-200', empty: 'No reports are waiting for review.' },
    { key: 'overdue', label: 'Overdue', icon: AlertCircle, tone: 'text-red-700 bg-red-50 border-red-200', empty: 'No reports are overdue.' },
    { key: 'due_soon', label: 'Due now', icon: Clock, tone: 'text-amber-800 bg-amber-50 border-amber-200', empty: 'No reports are currently due.' },
];

/** Monitoring → Progress Reports: what needs a review, what is overdue, what is due now. */
export default function ProgressReports() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('awaiting_review');

    const load = async () => {
        setLoading(true);
        try {
            const res = await get('/progress-reports');
            setData(res.data);
        } catch { setData({ awaiting_review: [], overdue: [], due_soon: [] }); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const rows = data?.[tab] ?? [];
    const section = SECTIONS.find((s) => s.key === tab);

    return (
        <AppLayout breadcrumb="Progress Reports">
            <div className="mx-auto max-w-5xl space-y-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-white"><ClipboardList size={20} /></span>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Progress Reports</h1>
                            <p className="text-sm text-gray-500">Regular reports from funded projects — review what came in, chase what is late</p>
                        </div>
                    </div>
                    <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    {SECTIONS.map((s) => (
                        <button key={s.key} onClick={() => setTab(s.key)}
                            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${tab === s.key ? `${s.tone} ring-2 ring-offset-1 ring-current/20` : 'border-gray-200 bg-white hover:shadow-sm'}`}>
                            <s.icon size={18} />
                            <span>
                                <span className="block text-2xl font-bold leading-none tabular-nums text-gray-900">{data?.[s.key]?.length ?? '—'}</span>
                                <span className="mt-1 block text-xs font-medium text-gray-600">{s.label}</span>
                            </span>
                        </button>
                    ))}
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    {loading && !data ? (
                        <div className="space-y-2 p-4 animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-gray-100" />)}</div>
                    ) : rows.length === 0 ? (
                        <div className="py-14 text-center text-sm text-gray-500"><Inbox size={26} className="mx-auto mb-2 text-gray-300" />{section.empty}</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {rows.map((r) => (
                                <li key={r.id}>
                                    <Link href={`/proposals/${r.proposal.id}?tab=Progress`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-gray-50">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-900"><span className="mr-2 font-mono text-xs text-blue-600">{r.proposal.tracker_number}</span>{r.proposal.title}</p>
                                            <p className="text-xs text-gray-500">
                                                {r.proposal.pi?.name ?? '—'} · {r.proposal.college?.name ?? '—'} · {r.is_final ? 'Final report' : `Report #${r.period_number}`}
                                            </p>
                                        </div>
                                        <span className="text-xs text-gray-500">{tab === 'awaiting_review' ? `submitted ${formatDate(r.submitted_at)}` : `due ${formatDate(r.due_date)}`}</span>
                                        {r.percent_complete !== null && tab === 'awaiting_review' && (
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-700">{r.percent_complete}%</span>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
