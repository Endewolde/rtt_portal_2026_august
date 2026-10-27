import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from '@inertiajs/react';
import {
    FileText, Search, X, Download, UserPlus, CheckCircle2, XCircle, Clock, AlertCircle, Star, Tag, Users,
    Send, Loader2, ExternalLink, ChevronLeft, ChevronRight, Inbox, Gavel, Trash2, ClipboardCheck, Undo2,
} from 'lucide-react';
import AppLayout from '../../Layouts/AppLayout';
import { PageHeader, Panel, EmptyState, Select, RefreshButton, Skeleton } from '../../Components/Insights/Kit';
import api from '../../lib/api';
import { downloadFile } from '../../lib/download';
import { useAuth } from '../../hooks/useAuth';
import ConfirmDialog from '../../Components/ConfirmDialog';
import { useToast } from '../../Components/Toast';
import { cn, formatDate } from '../../lib/utils';

// ─── Data ──────────────────────────────────────────────────────────────────────

const STATUSES = {
    draft:              { label: 'Draft',              dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600' },
    submitted:          { label: 'Submitted',          dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700' },
    under_review:       { label: 'Under review',       dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700' },
    revision_requested: { label: 'Revision requested', dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700' },
    accepted:           { label: 'Accepted',           dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
    rejected:           { label: 'Rejected',           dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600' },
    withdrawn:          { label: 'Withdrawn',          dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500' },
};

const DECISIONS = [
    { key: 'accepted', label: 'Accept', icon: CheckCircle2, on: 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    { key: 'revision_requested', label: 'Request revision', icon: Undo2, on: 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-100', btn: 'bg-amber-500 hover:bg-amber-600' },
    { key: 'rejected', label: 'Reject', icon: XCircle, on: 'border-red-500 bg-red-50 text-red-800 ring-2 ring-red-100', btn: 'bg-red-600 hover:bg-red-700' },
];

const NOTES_CFG = {
    accepted: { label: 'Next steps for the presenter', placeholder: 'e.g. Please prepare a 15-minute talk with slides. Your slot and room follow by …', hint: 'Sent to the submitter in the acceptance email.', required: true },
    revision_requested: { label: 'What needs to change', placeholder: 'Describe clearly what to change before the abstract can be accepted…', hint: 'The submitter gets this with a link to resubmit.', required: true },
    rejected: { label: 'Feedback for the author', placeholder: 'Optional: constructive feedback on the decision…', hint: 'Included in the decision email.', required: false },
};

const TYPES = ['oral', 'poster', 'workshop', 'panel', 'other'];
const TYPE_COLORS = {
    oral: 'bg-sky-50 text-sky-700', poster: 'bg-fuchsia-50 text-fuchsia-700', workshop: 'bg-teal-50 text-teal-700',
    panel: 'bg-orange-50 text-orange-700', other: 'bg-gray-100 text-gray-600',
};
const REC = {
    accept: { label: 'Accept', cls: 'bg-emerald-100 text-emerald-700' },
    revise: { label: 'Revise', cls: 'bg-amber-100 text-amber-700' },
    reject: { label: 'Reject', cls: 'bg-red-100 text-red-700' },
};
const OPEN = ['submitted', 'under_review', 'revision_requested'];

// ─── Small pieces ──────────────────────────────────────────────────────────────

function StatusDot({ status }) {
    const cfg = STATUSES[status] ?? STATUSES.draft;
    return (
        <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', cfg.badge)}>
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dot)} /> {cfg.label}
        </span>
    );
}

function TypeBadge({ type }) {
    return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', TYPE_COLORS[type] ?? TYPE_COLORS.other)}>{type ?? '—'}</span>;
}

const GRADIENTS = ['from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600', 'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600', 'from-pink-500 to-rose-600'];
const AVATAR_SIZES = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs' };

function Avatar({ name, size = 'sm' }) {
    const initials = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return (
        <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-bold text-white', AVATAR_SIZES[size], GRADIENTS[(name?.charCodeAt(0) ?? 0) % GRADIENTS.length])}>
            {initials}
        </span>
    );
}

/** Reviews in, out of those asked, with the average score. */
function ReviewProgress({ done = 0, asked = 0, average }) {
    if (!asked) return <span className="text-xs text-gray-400">No reviewers</span>;
    const complete = done === asked;
    return (
        <div className="min-w-24">
            <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className={complete ? 'font-semibold text-emerald-700' : 'text-gray-600'}>{done}/{asked} in</span>
                {average != null && <span className="inline-flex items-center gap-0.5 font-semibold text-gray-800"><Star size={10} className="text-amber-500" /> {Number(average).toFixed(1)}</span>}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className={cn('h-full rounded-full', complete ? 'bg-emerald-500' : 'bg-violet-500')} style={{ width: `${(done / asked) * 100}%` }} />
            </div>
        </div>
    );
}

// ─── Reviewer picker ───────────────────────────────────────────────────────────

function ReviewerPicker({ abstract, onAssigned }) {
    const { success, error } = useToast();
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState([]);
    const [searching, setSearching] = useState(false);
    const [busy, setBusy] = useState(null);
    const [askReset, setAskReset] = useState(null);

    useEffect(() => {
        if (search.trim().length < 2) { setUsers([]); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await api.get('/users', { params: { search, per_page: 8 } });
                const d = res.data?.data ?? res.data;
                setUsers(Array.isArray(d) ? d : (d?.data ?? []));
            } catch { setUsers([]); }
            setSearching(false);
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const assign = async (user, reset = false) => {
        setBusy(user.id);
        try {
            const r = await api.post(`/admin/abstracts/${abstract.id}/assign-reviewer`, { reviewer_id: user.id, reset });
            success(r.data?.message ?? 'Reviewer assigned.');
            setSearch('');
            setUsers([]);
            onAssigned();
        } catch (e) {
            if (e.response?.data?.meta?.code === 'already_reviewed') {
                setAskReset({ user, message: e.response.data.message });
            } else {
                error(e.response?.data?.message ?? 'Could not assign the reviewer.');
            }
        }
        setBusy(null);
    };

    const assigned = new Set((abstract.reviews ?? []).map((r) => r.reviewer_id));

    return (
        <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Add a reviewer — search by name or email…"
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
            {users.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {users.map((u) => {
                        const isSubmitter = u.email && abstract.submitter_email && u.email.toLowerCase() === abstract.submitter_email.toLowerCase();
                        const already = assigned.has(u.id);
                        return (
                            <button key={u.id} type="button" disabled={isSubmitter || busy === u.id} onClick={() => assign(u)}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50">
                                <Avatar name={u.name} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-gray-900">{u.name}</span>
                                    <span className="block truncate text-[11px] text-gray-500">{u.email}</span>
                                </span>
                                {isSubmitter && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Submitter</span>}
                                {already && !isSubmitter && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Assigned</span>}
                                {busy === u.id && <Loader2 size={13} className="animate-spin text-gray-400" />}
                            </button>
                        );
                    })}
                </div>
            )}
            <ConfirmDialog open={!!askReset} title="Ask this reviewer again?"
                description={`${askReset?.message ?? ''} Their score and comments will be cleared and they will be asked to review again.`}
                confirmLabel="Clear and ask again" confirmVariant="danger"
                onConfirm={() => { const u = askReset.user; setAskReset(null); assign(u, true); }}
                onCancel={() => setAskReset(null)} />
        </div>
    );
}

// ─── Decision dialog ───────────────────────────────────────────────────────────

function DecisionDialog({ abstract, onDone, onClose }) {
    const { success, error } = useToast();
    const [status, setStatus] = useState(DECISIONS.some((d) => d.key === abstract.status) ? abstract.status : 'accepted');
    const [notes, setNotes] = useState(abstract.admin_notes ?? '');
    const [busy, setBusy] = useState(false);
    const cfg = NOTES_CFG[status];
    const done = (abstract.reviews ?? []).filter((r) => r.submitted_at);
    const average = done.length ? done.reduce((s, r) => s + (r.score ?? 0), 0) / done.length : null;
    const tally = done.reduce((m, r) => ({ ...m, [r.recommendation]: (m[r.recommendation] ?? 0) + 1 }), {});
    const pending = (abstract.reviews ?? []).length - done.length;
    const decision = DECISIONS.find((d) => d.key === status);

    const save = async () => {
        if (cfg?.required && !notes.trim()) { error(`Add "${cfg.label}" first.`); return; }
        setBusy(true);
        try {
            const r = await api.patch(`/admin/abstracts/${abstract.id}/status`, { status, admin_notes: notes });
            success(r.data?.message ?? 'Saved.');
            onDone();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not save the decision.');
        }
        setBusy(false);
    };

    return (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><Gavel size={18} /></span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900">Committee decision</h2>
                            <p className="line-clamp-1 text-xs text-gray-500">{abstract.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                    <div className="rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
                        {done.length ? (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                                <span className="inline-flex items-center gap-1 font-bold text-gray-900"><Star size={14} className="text-amber-500" /> {average.toFixed(1)}<span className="text-xs font-normal text-gray-500">/10 average</span></span>
                                {Object.entries(REC).map(([k, r]) => tally[k] ? <span key={k} className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', r.cls)}>{tally[k]} × {r.label}</span> : null)}
                                {pending > 0 && <span className="text-xs text-amber-700">{pending} review{pending === 1 ? '' : 's'} still out</span>}
                            </div>
                        ) : (
                            <p className="flex items-center gap-1.5 text-sm text-amber-700"><AlertCircle size={14} /> No reviews yet — you can still decide.</p>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {DECISIONS.map((d) => (
                            <button key={d.key} type="button" onClick={() => setStatus(d.key)}
                                className={cn('flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition', status === d.key ? d.on : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                                <d.icon size={17} /> {d.label}
                            </button>
                        ))}
                    </div>
                    <label className="block">
                        <span className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-700">
                            <span>{cfg.label}{cfg.required && <span className="text-red-500"> *</span>}</span>
                            <span className="font-normal text-gray-400">{notes.length}/2000</span>
                        </span>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} maxLength={2000} placeholder={cfg.placeholder}
                            className="w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                        <span className="mt-1 block text-[11px] text-gray-500">{cfg.hint}</span>
                    </label>
                </div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={save} disabled={busy} className={cn('inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60', decision.btn)}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <decision.icon size={14} />} {decision.label} & email
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Next steps email ──────────────────────────────────────────────────────────

function NextStepsDialog({ abstract, onClose }) {
    const { success, error } = useToast();
    const [subject, setSubject] = useState(`Next steps — your accepted abstract | ${abstract.conference?.title ?? ''}`);
    const [body, setBody] = useState(abstract.admin_notes
        ? `${abstract.admin_notes}\n\nIf you have questions, reply to this email.`
        : 'Dear presenter,\n\nThank you for your accepted abstract. Here is what happens next:\n\n1. \n2. \n3. \n\nPlease confirm by replying to this email.\n\nWarm regards,\nThe Organising Committee');
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (!body.trim()) { error('The message cannot be empty.'); return; }
        setSending(true);
        try {
            await api.post(`/admin/abstracts/${abstract.id}/next-steps`, { subject, body });
            success(`Email sent to ${abstract.submitter_email}.`);
            onClose();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not send the email.');
        }
        setSending(false);
    };

    return (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Email the presenter</h2>
                        <p className="text-xs text-gray-500">To {abstract.submitter_name} &lt;{abstract.submitter_email}&gt;</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={5000}
                        className="w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-base leading-relaxed focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:text-sm" />
                </div>
                <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={send} disabled={sending} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send email
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function AbstractDrawer({ id, onClose, onChanged }) {
    const { success, error } = useToast();
    const [abs, setAbs] = useState(null);
    const [deciding, setDeciding] = useState(false);
    const [mailing, setMailing] = useState(false);
    const [removing, setRemoving] = useState(null);

    const load = useCallback(() => {
        api.get(`/admin/abstracts/${id}`).then((r) => setAbs(r.data?.data ?? null)).catch(() => error('Could not load the abstract.'));
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !deciding && !mailing) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [deciding, mailing, onClose]);

    const changed = () => { load(); onChanged(); };

    const removeReviewer = async (review) => {
        setRemoving(null);
        try {
            await api.delete(`/admin/abstracts/${id}/reviewers/${review.reviewer_id}`);
            success('Reviewer removed.');
            changed();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not remove the reviewer.');
        }
    };

    const open = abs && OPEN.includes(abs.status);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
            <aside role="dialog" aria-modal="true" className="relative flex h-full w-full max-w-2xl flex-col bg-gray-50 shadow-2xl">
                <header className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {abs && <StatusDot status={abs.status} />}
                            {abs && <TypeBadge type={abs.presentation_type} />}
                        </div>
                        <h2 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug text-gray-900">{abs?.title ?? 'Loading…'}</h2>
                        {abs?.conference && <p className="mt-0.5 text-xs text-gray-500">{abs.conference.title}</p>}
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </header>

                {!abs ? (
                    <div className="space-y-3 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
                ) : (
                    <div className="flex-1 space-y-4 overflow-y-auto p-6">
                        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <Avatar name={abs.submitter_name} size="md" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900">{abs.submitter_name}</p>
                                    <p className="truncate text-xs text-gray-500">{[abs.submitter_email, abs.submitter_affiliation].filter(Boolean).join(' · ')}</p>
                                </div>
                                <div className="ml-auto text-right text-[11px] text-gray-500">
                                    <p>Submitted {formatDate(abs.submitted_at)}</p>
                                    <p>{abs.word_count ? `${abs.word_count.toLocaleString()} words` : ''}</p>
                                </div>
                            </div>
                            {abs.co_authors?.length > 0 && (
                                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                                    <Users size={12} className="text-gray-400" />
                                    {abs.co_authors.map((c, i) => <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5">{c.name ?? c}{c.affiliation ? ` · ${c.affiliation}` : ''}</span>)}
                                </p>
                            )}
                        </section>

                        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Abstract</p>
                            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{abs.body}</p>
                            {abs.keywords?.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {abs.keywords.map((k, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"><Tag size={10} /> {k}</span>)}
                                </div>
                            )}
                            {abs.file_path && (
                                <a href={abs.file_path} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline">
                                    <ExternalLink size={13} /> Open the attached file
                                </a>
                            )}
                        </section>

                        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reviewers</p>
                                {abs.average_score != null && <span className="inline-flex items-center gap-1 text-sm font-bold text-gray-900"><Star size={13} className="text-amber-500" /> {Number(abs.average_score).toFixed(1)}<span className="text-xs font-normal text-gray-500">/10</span></span>}
                            </div>
                            <div className="space-y-2">
                                {(abs.reviews ?? []).length === 0 && <p className="text-sm text-gray-500">No reviewers yet.</p>}
                                {(abs.reviews ?? []).map((r) => (
                                    <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                                        <div className="flex items-center gap-2.5">
                                            <Avatar name={r.reviewer?.name} />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{r.reviewer?.name ?? 'Reviewer'}</span>
                                            {r.submitted_at ? (
                                                <>
                                                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">{r.score}/10</span>
                                                    {REC[r.recommendation] && <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', REC[r.recommendation].cls)}>{REC[r.recommendation].label}</span>}
                                                </>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><Clock size={11} /> Waiting</span>
                                            )}
                                            {open && <button onClick={() => setRemoving(r)} aria-label="Remove reviewer" className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>}
                                        </div>
                                        {r.comments && <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-600">{r.comments}</p>}
                                    </div>
                                ))}
                            </div>
                            {open && <div className="mt-3"><ReviewerPicker abstract={abs} onAssigned={changed} /></div>}
                        </section>

                        {abs.admin_notes && (
                            <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Message sent to the submitter</p>
                                <p className="whitespace-pre-line text-sm text-amber-900">{abs.admin_notes}</p>
                            </section>
                        )}
                    </div>
                )}

                {abs?.status === 'draft' && (
                    <footer className="border-t border-gray-200 bg-white px-6 py-3 text-xs text-gray-500">
                        A draft is the submitter's unfinished work — it can be reviewed and decided once they submit it.
                    </footer>
                )}
                {abs && !['withdrawn', 'draft'].includes(abs.status) && (
                    <footer className="flex flex-wrap gap-2 border-t border-gray-200 bg-white px-6 py-3">
                        {abs.status === 'accepted' && (
                            <button onClick={() => setMailing(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                                <Send size={14} /> Email next steps
                            </button>
                        )}
                        <button onClick={() => setDeciding(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                            <Gavel size={14} /> {OPEN.includes(abs.status) ? 'Decide' : 'Change decision'}
                        </button>
                    </footer>
                )}
            </aside>

            <ConfirmDialog open={!!removing} title="Remove this reviewer?"
                description={`${removing?.reviewer?.name ?? 'The reviewer'} will be taken off this abstract${removing?.submitted_at ? ', and their review deleted' : ''}.`}
                confirmLabel="Remove" confirmVariant="danger"
                onConfirm={() => removeReviewer(removing)} onCancel={() => setRemoving(null)} />
            {deciding && abs && <DecisionDialog abstract={abs} onClose={() => setDeciding(false)} onDone={() => { setDeciding(false); changed(); }} />}
            {mailing && abs && <NextStepsDialog abstract={abs} onClose={() => setMailing(false)} />}
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const STAGES = [
    { key: '', label: 'Received', icon: Inbox, count: (c) => c.total, tone: 'text-gray-900' },
    { key: 'submitted', label: 'To assign', icon: UserPlus, count: (c) => c.submitted, tone: 'text-blue-700', hint: 'No reviewer yet' },
    { key: 'under_review', label: 'Under review', icon: Clock, count: (c) => c.under_review, tone: 'text-violet-700' },
    { key: 'ready_for_decision', label: 'Ready to decide', icon: Gavel, count: (c) => c.ready_for_decision, tone: 'text-indigo-700', hint: 'All reviews in', strong: true },
    { key: 'revision_requested', label: 'Revision', icon: Undo2, count: (c) => c.revision_requested, tone: 'text-amber-700' },
    { key: 'accepted', label: 'Accepted', icon: CheckCircle2, count: (c) => c.accepted, tone: 'text-emerald-700' },
    { key: 'rejected', label: 'Rejected', icon: XCircle, count: (c) => c.rejected, tone: 'text-red-700' },
];

export default function AdminAbstracts() {
    const { hasPermission } = useAuth();
    const { error } = useToast();
    const [rows, setRows] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [type, setType] = useState('');
    const [sort, setSort] = useState('newest');
    const [conferenceId, setConferenceId] = useState(() => new URLSearchParams(window.location.search).get('conference_id') ?? '');
    const [conferences, setConferences] = useState([]);
    const [page, setPage] = useState(1);
    const [openId, setOpenId] = useState(null);
    const [exporting, setExporting] = useState(false);
    const searchTimer = useRef(null);

    const isAdmin = hasPermission('conferences.manage');

    useEffect(() => {
        if (!isAdmin) return;
        api.get('/admin/conferences', { params: { per_page: 200 } })
            .then((r) => setConferences(r.data?.data?.data ?? []))
            .catch(() => {});
    }, [isAdmin]);

    const params = { page, search: query || undefined, status: status || undefined, type: type || undefined, conference_id: conferenceId || undefined, sort };

    const load = useCallback(async () => {
        if (!isAdmin) return;
        setLoading(true);
        try {
            const r = await api.get('/admin/abstracts', { params });
            const pg = r.data?.data ?? {};
            setRows(pg.data ?? []);
            setMeta(pg);
        } catch {
            setRows((v) => v ?? []);
            error('Could not load abstracts.');
        }
        setLoading(false);
    }, [page, query, status, type, conferenceId, sort, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const onSearch = (v) => {
        setSearch(v);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { setQuery(v.trim()); setPage(1); }, 300);
    };

    const exportCsv = async () => {
        setExporting(true);
        const qs = new URLSearchParams(Object.entries({ search: query, status, type, conference_id: conferenceId }).filter(([, v]) => v)).toString();
        try {
            await downloadFile(`/admin/abstracts/export${qs ? `?${qs}` : ''}`, 'abstracts.csv');
        } catch {
            error('The export could not be downloaded.');
        }
        setExporting(false);
    };

    const counts = meta?.counts ?? {};
    const lastPage = meta?.last_page ?? 1;
    const filtersOn = !!(query || status || type || conferenceId);

    if (!isAdmin) {
        return (
            <AppLayout breadcrumb="Abstracts">
                <div className="mx-auto max-w-xl">
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={AlertCircle} title="For the conference committee" text="Abstracts you have been asked to review are on your Reviews page.">
                            <Link href="/reviews" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline">Go to my reviews <ChevronRight size={14} /></Link>
                        </EmptyState>
                    </Panel>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumb="Abstracts">
            <div className="mx-auto max-w-7xl space-y-5">
                <PageHeader icon={FileText} color="violet" title="Abstracts"
                    description="Conference submissions: assign reviewers, read their reviews, then decide — the submitter only hears the committee's decision.">
                    <button onClick={exportCsv} disabled={exporting}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} <span className="hidden sm:inline">Export CSV</span>
                    </button>
                    <RefreshButton onClick={load} loading={loading} />
                </PageHeader>

                {/* Stages */}
                <div className="-mx-1 grid grid-cols-2 gap-2 px-1 sm:grid-cols-4 xl:grid-cols-7">
                    {STAGES.map((s) => {
                        const active = status === s.key;
                        const n = meta ? (s.count(counts) ?? 0) : null;
                        return (
                            <button key={s.label} onClick={() => { setStatus(s.key); setPage(1); }} aria-pressed={active}
                                className={cn('rounded-2xl border p-3 text-left transition',
                                    active ? 'border-gray-900 bg-gray-900 text-white shadow' : s.strong && n ? 'border-indigo-200 bg-indigo-50 hover:border-indigo-300' : 'border-gray-200 bg-white hover:border-gray-300')}>
                                <p className={cn('flex items-center gap-1.5 text-[11px] font-semibold', active ? 'text-white/80' : 'text-gray-500')}><s.icon size={12} /> {s.label}</p>
                                <p className={cn('mt-1 text-2xl font-bold tabular-nums', active ? 'text-white' : s.tone)}>{n ?? '—'}</p>
                                {s.hint && <p className={cn('text-[10px]', active ? 'text-white/70' : 'text-gray-400')}>{s.hint}</p>}
                            </button>
                        );
                    })}
                </div>

                {/* Toolbar */}
                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:flex-row">
                    <label className="relative min-w-0 flex-1">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search title, submitter or email…"
                            className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-base focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm" />
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Select label="Conference" value={conferenceId} onChange={(v) => { setConferenceId(v); setPage(1); }} className="sm:w-56">
                            <option value="">All conferences</option>
                            {conferences.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </Select>
                        <Select label="Type" value={type} onChange={(v) => { setType(v); setPage(1); }} className="sm:w-36">
                            <option value="">All types</option>
                            {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                        </Select>
                        <Select label="Sort" value={sort} onChange={setSort} className="sm:w-40">
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="score">Best score</option>
                            <option value="title">Title A–Z</option>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center justify-between px-1 text-sm text-gray-600">
                    <p className="flex flex-wrap items-center gap-2">
                        <span><b className="text-gray-900">{meta?.total ?? 0}</b> abstract{meta?.total === 1 ? '' : 's'}{status && <> · {status === 'draft' ? 'Drafts' : STAGES.find((s) => s.key === status)?.label}</>}</span>
                        {(counts.draft ?? 0) > 0 && status !== 'draft' && (
                            <button onClick={() => { setStatus('draft'); setPage(1); }} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 hover:bg-gray-200" title="Unfinished work submitters saved but have not submitted">
                                {counts.draft} draft{counts.draft === 1 ? '' : 's'} not yet submitted
                            </button>
                        )}
                    </p>
                    {filtersOn && (
                        <button onClick={() => { setSearch(''); setQuery(''); setStatus(''); setType(''); setConferenceId(''); setPage(1); }}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"><X size={12} /> Clear filters</button>
                    )}
                </div>

                {/* List */}
                {rows === null ? (
                    <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : rows.length === 0 ? (
                    <Panel bodyClassName="p-0">
                        <EmptyState icon={Inbox} title={filtersOn ? 'Nothing matches' : 'No abstracts yet'} text={filtersOn ? 'Try another search or filter.' : 'Submissions appear here once a conference opens its call for abstracts.'} />
                    </Panel>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-225 text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                        <th className="w-10 px-4 py-3 text-gray-400">#</th>
                                        <th className="px-4 py-3">Abstract</th>
                                        <th className="px-4 py-3">Submitter</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Reviews</th>
                                        <th className="px-4 py-3">Submitted</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rows.map((a, i) => (
                                        <tr key={a.id} className="cursor-pointer transition-colors hover:bg-indigo-50/30" onClick={() => setOpenId(a.id)}>
                                            <td className="px-4 py-3 text-xs tabular-nums text-gray-400">{((meta?.current_page ?? 1) - 1) * (meta?.per_page ?? 25) + i + 1}</td>
                                            <td className="max-w-sm px-4 py-3">
                                                <p className="line-clamp-1 font-medium text-gray-900">{a.title}</p>
                                                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500"><TypeBadge type={a.presentation_type} /> <span className="truncate">{a.conference?.title}</span></p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-2"><Avatar name={a.submitter_name} />
                                                    <span className="min-w-0"><span className="block max-w-44 truncate text-xs font-medium text-gray-800">{a.submitter_name}</span>
                                                        {a.submitter_affiliation && <span className="block max-w-44 truncate text-[11px] text-gray-400">{a.submitter_affiliation}</span>}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3"><StatusDot status={a.status} /></td>
                                            <td className="px-4 py-3"><ReviewProgress done={a.reviews_done_count} asked={a.reviews_count} average={a.average_score} /></td>
                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDate(a.submitted_at)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold',
                                                    a.status === 'submitted' ? 'bg-blue-50 text-blue-700' : a.reviews_count && a.reviews_done_count === a.reviews_count && a.status === 'under_review' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700')}>
                                                    {a.status === 'submitted' ? <><UserPlus size={12} /> Assign</> : a.reviews_count && a.reviews_done_count === a.reviews_count && a.status === 'under_review' ? <><Gavel size={12} /> Decide</> : <><ClipboardCheck size={12} /> Open</>}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <ul className="divide-y divide-gray-100 md:hidden">
                            {rows.map((a) => (
                                <li key={a.id}>
                                    <button onClick={() => setOpenId(a.id)} className="w-full space-y-2 px-4 py-3 text-left hover:bg-gray-50">
                                        <p className="line-clamp-2 text-sm font-semibold text-gray-900">{a.title}</p>
                                        <p className="text-xs text-gray-500">{a.submitter_name} · {a.conference?.title}</p>
                                        <div className="flex flex-wrap items-center gap-2"><StatusDot status={a.status} /><TypeBadge type={a.presentation_type} /></div>
                                        <ReviewProgress done={a.reviews_done_count} asked={a.reviews_count} average={a.average_score} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {lastPage > 1 && (
                    <div className="flex items-center justify-between px-1">
                        <p className="text-xs text-gray-500">Page {meta.current_page} of {lastPage}</p>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
                            <button disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={15} /></button>
                        </div>
                    </div>
                )}
            </div>

            {openId && <AbstractDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
        </AppLayout>
    );
}
