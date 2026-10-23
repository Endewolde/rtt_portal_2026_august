import { useState, useEffect, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    CalendarPlus, CheckCircle2, XCircle, Clock, RefreshCw, Building2, User, CalendarClock, Repeat,
    AlertTriangle, Search, ChevronDown, ChevronRight, X, ArrowRight, Users,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { get, post } from '../../lib/api';
import { getCategoryLabel, timeAgo } from '../../lib/utils';
import { useToast } from '../../Components/Toast';
import { formatDeadline } from '../../Components/DefenceDeadlineStrip';

const TABS = [
    { key: 'pending', label: 'Awaiting decision', icon: Clock },
    { key: 'approved', label: 'Approved', icon: CheckCircle2 },
    { key: 'denied', label: 'Denied', icon: XCircle },
];

const STATUS_PILL = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    denied: 'bg-red-50 text-red-700 ring-red-200',
};
const STATUS_LABEL = { pending: 'Awaiting decision', approved: 'Approved', denied: 'Denied' };

const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const toLocalInput = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "2nd request" — amber for a second request, red from the third on. */
function RepeatBadge({ sequence }) {
    if (!sequence || sequence < 2) {
        return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">First request</span>;
    }
    const cls = sequence >= 3 ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-amber-50 text-amber-800 ring-amber-200';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
            <Repeat size={11} /> {ordinal(sequence)} request
        </span>
    );
}

/** The deadline's path: original → in force before this request → requested or granted. */
function DeadlineTrack({ ext }) {
    const extended = ext.days_already_extended > 0;
    const target = ext.status === 'approved' ? ext.granted_until : ext.requested_until;
    const targetLabel = ext.status === 'approved' ? 'Granted until' : ext.status === 'denied' ? 'Was requested' : 'Requested';
    const steps = [
        { label: 'Original deadline', value: ext.original_deadline, tone: 'text-gray-700', dot: 'bg-gray-400' },
        ...(extended ? [{ label: 'Already extended to', value: ext.deadline_before, extra: `+${plural(ext.days_already_extended, 'day')}`, tone: 'text-amber-800', dot: 'bg-amber-500' }] : []),
        {
            label: targetLabel, value: target,
            extra: ext.days_requested != null ? `+${plural(ext.days_requested, 'day')}` : null,
            tone: ext.status === 'denied' ? 'text-gray-400 line-through' : 'text-indigo-800',
            dot: ext.status === 'denied' ? 'bg-gray-300' : 'bg-indigo-600',
        },
    ];

    return (
        <ol className="grid gap-3 sm:flex sm:items-start sm:gap-0">
            {steps.map((st, i) => (
                <li key={st.label} className="flex items-start gap-2.5 sm:flex-1 sm:flex-col sm:gap-1.5">
                    <div className="flex items-center sm:w-full">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${st.dot}`} />
                        {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-gray-200 sm:block" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{st.label}</p>
                        <p className={`text-sm font-semibold ${st.tone}`}>{st.value ? formatDeadline(st.value) : '—'}</p>
                        {st.extra && <p className="text-[11px] font-medium text-gray-500">{st.extra}</p>}
                    </div>
                </li>
            ))}
        </ol>
    );
}

function PanelProgress({ outstanding, size }) {
    if (size == null || size === 0) return null;
    const done = Math.max(0, size - (outstanding ?? 0));
    return (
        <div className="flex items-center gap-3 text-xs text-gray-600">
            <Users size={13} className="shrink-0 text-gray-400" />
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(done / size) * 100}%` }} />
            </div>
            <span>{outstanding > 0 ? `${outstanding} of ${size} panel scores still missing` : `All ${size} panel scores in`}</span>
        </div>
    );
}

function EarlierRequests({ items }) {
    const [open, setOpen] = useState(false);
    if (!items?.length) return null;
    return (
        <div className="rounded-xl border border-gray-100">
            <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-gray-50">
                {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Earlier requests for this defence ({items.length})
            </button>
            {open && (
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                    {items.map((r, i) => (
                        <li key={i} className="space-y-1 px-3 py-2.5 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-gray-700">{ordinal(i + 1)} request</span>
                                <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                                <span className="text-gray-400">{r.requested_by} · {formatDeadline(r.created_at)}</span>
                            </div>
                            <p className="text-gray-600">
                                Asked until {formatDeadline(r.requested_until)}
                                {r.status === 'approved' && r.granted_until && <> · granted until <strong>{formatDeadline(r.granted_until)}</strong></>}
                            </p>
                            <p className="text-gray-500">“{r.reason}”</p>
                            {r.decision_notes && <p className="text-gray-500">{r.decided_by}: {r.decision_notes}</p>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function DecideModal({ extension: ext, onSaved, onClose }) {
    const { success, error } = useToast();
    const [decision, setDecision] = useState('approved');
    const [grantedUntil, setGrantedUntil] = useState(toLocalInput(ext.requested_until));
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const repeat = ext.sequence >= 2;

    const submit = async () => {
        if (notes.trim().length < 5) { error('Please add a short note explaining your decision.'); return; }
        setSaving(true);
        try {
            const payload = { decision, notes };
            if (decision === 'approved') payload.granted_until = grantedUntil;
            const res = await post(`/defence-deadline-extensions/${ext.id}/decide`, payload);
            success(res.message ?? 'Decision saved.');
            onSaved();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not save the decision.');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-gray-900">Decide extension request</h2>
                            <RepeatBadge sequence={ext.sequence} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{ext.proposal.tracker_number} · {ext.proposal.title}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    {repeat && (
                        <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${ext.sequence >= 3 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold">This is the {ordinal(ext.sequence)} extension request for this defence.</p>
                                <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                                    {ext.days_already_extended > 0
                                        ? `The deadline has already been extended by ${plural(ext.days_already_extended, 'day')}, to ${formatDeadline(ext.deadline_before)}.`
                                        : 'Earlier requests did not move the deadline.'}
                                    {ext.days_requested != null && ` This request asks for ${plural(ext.days_requested, 'more day')}.`}
                                    {' '}Consider whether a missing panel member should be replaced instead.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                        <DeadlineTrack ext={ext} />
                        <div className="mt-3 border-t border-gray-100 pt-3"><PanelProgress outstanding={ext.outstanding_scores} size={ext.panel_size} /></div>
                    </div>

                    <div>
                        <p className="mb-1 text-xs font-semibold text-gray-700">Reason from {ext.requested_by}</p>
                        <p className="rounded-xl border-l-4 border-indigo-200 bg-indigo-50/40 px-3 py-2 text-sm leading-relaxed text-gray-700">{ext.reason}</p>
                    </div>

                    <EarlierRequests items={ext.earlier_requests} />

                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { key: 'approved', label: 'Approve', icon: CheckCircle2, on: 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100' },
                            { key: 'denied', label: 'Deny', icon: XCircle, on: 'border-red-500 bg-red-50 text-red-800 ring-2 ring-red-100' },
                        ].map(({ key, label, icon: Icon, on }) => (
                            <button key={key} type="button" onClick={() => setDecision(key)}
                                className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${decision === key ? on : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                <Icon size={15} /> {label}
                            </button>
                        ))}
                    </div>

                    {decision === 'approved' && (
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">New score deadline <span className="text-red-500">*</span></label>
                            <input type="datetime-local" value={grantedUntil} min={toLocalInput(new Date().toISOString())}
                                onChange={(e) => setGrantedUntil(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                            <p className="mt-1 text-xs text-gray-400">Defaults to the requested date — you can grant a shorter one.</p>
                        </div>
                    )}

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Note to the college officer <span className="text-red-500">*</span></label>
                        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder={repeat ? 'e.g. Approved as a final extension — replace the reviewer if they miss this date.' : 'Explain your decision…'}
                            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                    </div>
                </div>

                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={submit} disabled={saving || (decision === 'approved' && !grantedUntil)}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                        {saving ? 'Saving…' : decision === 'approved' ? 'Approve extension' : 'Deny request'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatTile({ label, value, hint, icon: Icon, tone, active, onClick }) {
    return (
        <button onClick={onClick}
            className={`rounded-2xl border bg-white p-4 text-left transition-all hover:shadow-sm ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <Icon size={15} className={tone} />
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
        </button>
    );
}

function ExtensionCard({ ext, onReview }) {
    const repeat = ext.sequence >= 2;
    const accent = ext.status !== 'pending' ? 'border-l-gray-200' : ext.sequence >= 3 ? 'border-l-red-500' : repeat ? 'border-l-amber-500' : 'border-l-indigo-500';

    return (
        <article className={`overflow-hidden rounded-2xl border border-l-4 border-gray-200 bg-white shadow-sm ${accent}`}>
            <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{ext.proposal.tracker_number}</span>
                            <span className="text-xs text-gray-400">{getCategoryLabel(ext.proposal.category)}</span>
                            <RepeatBadge sequence={ext.sequence} />
                            {ext.status !== 'pending' && (
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_PILL[ext.status]}`}>{STATUS_LABEL[ext.status]}</span>
                            )}
                        </div>
                        <Link href={`/proposals/${ext.proposal.id}`} className="mt-1.5 block truncate text-sm font-semibold text-gray-900 hover:text-indigo-700">
                            {ext.proposal.title}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Building2 size={11} /> {ext.proposal.college_name ?? '—'}</span>
                            <span className="flex items-center gap-1"><User size={11} /> {ext.requested_by}</span>
                            <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(ext.created_at)}</span>
                            {ext.defence_date && <span className="flex items-center gap-1"><CalendarClock size={11} /> Defence {ext.defence_date}</span>}
                        </p>
                    </div>
                </div>

                <DeadlineTrack ext={ext} />
                <PanelProgress outstanding={ext.outstanding_scores} size={ext.panel_size} />

                <p className="rounded-xl border-l-4 border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">{ext.reason}</p>

                <EarlierRequests items={ext.earlier_requests} />

                {ext.decision_notes && (
                    <p className="text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">{ext.decided_by}</span> · {formatDeadline(ext.decided_at)} — {ext.decision_notes}
                    </p>
                )}
            </div>
            {ext.status === 'pending' && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                    <p className="text-xs text-gray-500">
                        {repeat ? `Asked before for this defence — ${plural(ext.sequence - 1, 'earlier request')}.` : 'First extension request for this defence.'}
                    </p>
                    <button onClick={() => onReview(ext)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                        Review request <ArrowRight size={14} />
                    </button>
                </div>
            )}
        </article>
    );
}

export default function DefenceExtensions() {
    const [filter, setFilter] = useState('pending');
    const [repeatOnly, setRepeatOnly] = useState(false);
    const [query, setQuery] = useState('');
    const [extensions, setExtensions] = useState([]);
    const [counts, setCounts] = useState({ pending: 0, approved: 0, denied: 0, repeat_pending: 0 });
    const [loading, setLoading] = useState(true);
    const [deciding, setDeciding] = useState(null);
    const { error } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const res = await get('/defence-deadline-extensions', { status: filter });
            setExtensions(res.data ?? []);
            setCounts(res.meta?.counts ?? {});
        } catch { error('Failed to load defence deadline extensions.'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return extensions
            .filter((e) => !repeatOnly || e.sequence >= 2)
            .filter((e) => !q || [e.proposal.tracker_number, e.proposal.title, e.proposal.college_name, e.requested_by].some((v) => v?.toLowerCase().includes(q)))
            // Repeat requests first while deciding — they need the closest look.
            .sort((a, b) => (filter === 'pending' ? (b.sequence ?? 1) - (a.sequence ?? 1) : 0));
    }, [extensions, repeatOnly, query, filter]);

    return (
        <AppLayout breadcrumb="Defence Deadline Extensions">
            <div className="mx-auto max-w-5xl space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900"><CalendarPlus size={20} className="text-white" /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Defence Deadline Extensions</h1>
                            <p className="mt-0.5 text-sm text-gray-500">College officers' requests to give open defence panels more time to submit scores.</p>
                        </div>
                    </div>
                    <button onClick={load} disabled={loading} className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatTile label="Awaiting decision" value={counts.pending ?? 0} icon={Clock} tone="text-indigo-500"
                        active={filter === 'pending' && !repeatOnly} onClick={() => { setFilter('pending'); setRepeatOnly(false); }} />
                    <StatTile label="Repeat requests" value={counts.repeat_pending ?? 0} hint="Asked before, awaiting decision" icon={Repeat} tone="text-amber-500"
                        active={filter === 'pending' && repeatOnly} onClick={() => { setFilter('pending'); setRepeatOnly(true); }} />
                    <StatTile label="Approved" value={counts.approved ?? 0} icon={CheckCircle2} tone="text-emerald-500"
                        active={filter === 'approved'} onClick={() => { setFilter('approved'); setRepeatOnly(false); }} />
                    <StatTile label="Denied" value={counts.denied ?? 0} icon={XCircle} tone="text-red-500"
                        active={filter === 'denied'} onClick={() => { setFilter('denied'); setRepeatOnly(false); }} />
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button key={key} onClick={() => setFilter(key)}
                                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <Icon size={13} /> {label}
                                <span className="rounded-full bg-gray-100 px-1.5 text-[11px] tabular-nums text-gray-600">{counts[key] ?? 0}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 focus-within:ring-2 focus-within:ring-indigo-500">
                        <Search size={14} className="text-gray-400" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tracker, title, college or officer…" className="h-10 flex-1 bg-transparent text-sm outline-none" />
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={repeatOnly} onChange={(e) => setRepeatOnly(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-amber-600" />
                        Repeat requests only
                    </label>
                </div>

                {loading && extensions.length === 0 ? (
                    <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl border border-gray-200 bg-gray-50" />)}</div>
                ) : shown.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
                        <CalendarClock size={28} className="mx-auto text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">
                            {query || repeatOnly ? 'No requests match.' : filter === 'pending' ? 'No requests are waiting for a decision.' : `No ${STATUS_LABEL[filter].toLowerCase()} requests yet.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">{shown.map((ext) => <ExtensionCard key={ext.id} ext={ext} onReview={setDeciding} />)}</div>
                )}
            </div>

            {deciding && <DecideModal extension={deciding} onClose={() => setDeciding(null)} onSaved={() => { setDeciding(null); load(); }} />}
        </AppLayout>
    );
}
