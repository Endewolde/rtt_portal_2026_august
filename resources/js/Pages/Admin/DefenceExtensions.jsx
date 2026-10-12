import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { CalendarPlus, CheckCircle, XCircle, Clock, RefreshCw, Building2, User, CalendarClock } from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { getCategoryLabel } from '../../lib/utils';
import { useToast } from '../../Components/Toast';
import { formatDeadline } from '../../Components/DefenceDeadlineStrip';

const TABS = [
    { key: 'pending',  label: 'Pending',  icon: Clock,       iconCls: 'text-amber-500' },
    { key: 'approved', label: 'Approved', icon: CheckCircle, iconCls: 'text-emerald-500' },
    { key: 'denied',   label: 'Denied',   icon: XCircle,     iconCls: 'text-red-500' },
];

const toLocalInput = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function DecideModal({ extension, onSaved, onClose }) {
    const { success, error } = useToast();
    const [decision, setDecision] = useState('approved');
    const [grantedUntil, setGrantedUntil] = useState(toLocalInput(extension.requested_until));
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (notes.trim().length < 5) { error('Please add a short note explaining your decision.'); return; }
        setSaving(true);
        try {
            const payload = { decision, notes };
            if (decision === 'approved') payload.granted_until = grantedUntil;
            const res = await post(`/defence-deadline-extensions/${extension.id}/decide`, payload);
            success(res.message ?? 'Decision saved.');
            onSaved();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not save the decision.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="bg-linear-to-r from-slate-800 to-slate-700 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                            <CalendarPlus size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Decide Score Deadline Extension</h2>
                            <p className="mt-0.5 font-mono text-xs text-slate-400">{extension.proposal.tracker_number} · {getCategoryLabel(extension.proposal.category)}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 p-6">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">College officer's reason</p>
                        <p className="text-sm leading-relaxed text-slate-700">{extension.reason}</p>
                        <p className="mt-2 text-xs text-slate-400">
                            {extension.requested_by} · current deadline {formatDeadline(extension.current_deadline)} · requested {formatDeadline(extension.requested_until)}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setDecision('approved')}
                            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all ${
                                decision === 'approved' ? 'border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'
                            }`}
                        >
                            <CheckCircle size={15} /> Approve
                        </button>
                        <button
                            onClick={() => setDecision('denied')}
                            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all ${
                                decision === 'denied' ? 'border-red-600 bg-red-600 text-white shadow-lg shadow-red-100' : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600'
                            }`}
                        >
                            <XCircle size={15} /> Deny
                        </button>
                    </div>

                    {decision === 'approved' && (
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">New score deadline <span className="text-red-500">*</span></label>
                            <input
                                type="datetime-local"
                                value={grantedUntil}
                                min={toLocalInput(new Date().toISOString())}
                                onChange={(e) => setGrantedUntil(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                            <p className="mt-1 text-xs text-gray-400">Defaults to the requested date — adjust it to grant a different deadline.</p>
                        </div>
                    )}

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Note to the college officer <span className="text-red-500">*</span></label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Explain your decision…"
                            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={saving || (decision === 'approved' && !grantedUntil)}
                            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                                decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {saving ? 'Saving…' : decision === 'approved' ? 'Approve Extension' : 'Deny Request'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DefenceExtensions() {
    const [filter, setFilter] = useState('pending');
    const [extensions, setExtensions] = useState([]);
    const [counts, setCounts] = useState({ pending: 0, approved: 0, denied: 0 });
    const [loading, setLoading] = useState(true);
    const [deciding, setDeciding] = useState(null);
    const { error } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res = await get('/defence-deadline-extensions', { status: filter });
            setExtensions(res.data ?? []);
            setCounts(res.meta?.counts ?? { pending: 0, approved: 0, denied: 0 });
        } catch { error('Failed to load defence deadline extensions.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filter]);

    return (
        <AppLayout breadcrumb="Defence Deadline Extensions">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900">
                            <CalendarPlus size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Defence Deadline Extensions</h1>
                            <p className="mt-0.5 text-sm text-gray-500">Approve college officer requests to give open defence reviewers more time to submit scores</p>
                        </div>
                    </div>
                    <button onClick={load} className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                                filter === tab.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <tab.icon size={14} className={filter === tab.key ? 'text-white' : tab.iconCls} />
                            {tab.label}
                            <span className={`rounded-full px-1.5 text-xs ${filter === tab.key ? 'bg-white/20' : 'bg-gray-100'}`}>{counts[tab.key] ?? 0}</span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-gray-50" />)}
                    </div>
                ) : extensions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center">
                        <CalendarClock size={28} className="mx-auto text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">No {filter} extension requests.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {extensions.map((ext) => (
                            <div key={ext.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <div className="space-y-3 p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-lg border border-purple-100 bg-purple-50 px-2 py-0.5 font-mono text-xs font-bold text-purple-700">{ext.proposal.tracker_number}</span>
                                                <span className="text-xs text-gray-400">{getCategoryLabel(ext.proposal.category)}</span>
                                            </div>
                                            <Link href={`/proposals/${ext.proposal.id}`} className="mt-1 block truncate text-sm font-semibold text-gray-900 hover:underline">
                                                {ext.proposal.title}
                                            </Link>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1"><Building2 size={11} /> {ext.proposal.college_name}</span>
                                                <span className="flex items-center gap-1"><User size={11} /> {ext.requested_by} · {formatDeadline(ext.created_at)}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-3">
                                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Defence day</p>
                                            <p className="text-sm font-semibold text-gray-800">{ext.defence_date ?? '—'}</p>
                                        </div>
                                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{ext.status === 'approved' ? 'Deadline now' : 'Current deadline'}</p>
                                            <p className="text-sm font-semibold text-gray-800">{formatDeadline(ext.current_deadline)}</p>
                                        </div>
                                        <div className="rounded-xl bg-purple-50 px-3 py-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-500">{ext.status === 'approved' ? 'Granted until' : 'Requested until'}</p>
                                            <p className="text-sm font-semibold text-purple-800">{formatDeadline(ext.granted_until ?? ext.requested_until)}</p>
                                        </div>
                                    </div>

                                    <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">{ext.reason}</p>
                                    {ext.decision_notes && (
                                        <p className="text-xs italic text-gray-500">{ext.decided_by} · {formatDeadline(ext.decided_at)}: {ext.decision_notes}</p>
                                    )}
                                </div>
                                {ext.status === 'pending' && (
                                    <div className="flex justify-end border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                                        <button
                                            onClick={() => setDeciding(ext)}
                                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                        >
                                            Review Request
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {deciding && <DecideModal extension={deciding} onClose={() => setDeciding(null)} onSaved={() => { setDeciding(null); load(); }} />}
        </AppLayout>
    );
}
