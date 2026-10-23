import { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Scale, UserPlus, Gavel, X, CheckCircle2, XCircle, Hourglass, Globe2, AlertTriangle, Search } from 'lucide-react';
import { get, post } from '../lib/api';
import { useToast } from './Toast';
import { isConflictWarning } from './ReviewerConflictBadge';

/** Pick a reviewer for a second opinion from the suggestions, and invite them. */
function SecondOpinionModal({ proposal, onClose, onInvited }) {
    const { success, error } = useToast();
    const [suggestions, setSuggestions] = useState(null);
    const [selected, setSelected] = useState(null);
    const [dueDate, setDueDate] = useState(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        get(`/proposals/${proposal.id}/second-opinion/suggestions`)
            .then((r) => setSuggestions(r.data ?? []))
            .catch(() => { setSuggestions([]); error('Could not load suggested reviewers.'); });
    }, [proposal.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const invite = async (overrideWorkloadCap = false, acknowledgeConflicts = false) => {
        if (!selected) return;
        setSaving(true);
        try {
            await post(`/proposals/${proposal.id}/review/add-reviewer`, {
                reviewer_id: selected.id, due_date: dueDate,
                override_workload_cap: overrideWorkloadCap, acknowledge_conflicts: acknowledgeConflicts,
            });
            success(`${selected.name} has been invited for a second opinion.`);
            onInvited();
        } catch (e) {
            const msg = e.response?.data?.message || 'Could not invite this reviewer.';
            if (msg.includes('max workload')) {
                error(msg, { action: { label: 'Invite anyway', onClick: () => invite(true, acknowledgeConflicts) } });
            } else if (isConflictWarning(msg)) {
                error(msg, { duration: 12000, action: { label: 'Invite anyway', onClick: () => invite(overrideWorkloadCap, true) } });
            } else {
                error(msg);
            }
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Get a second opinion</h2>
                        <p className="mt-0.5 text-xs text-gray-500">
                            Reviewers whose expertise matches this proposal, best first. When their score is in, the two closest scores decide and the furthest is set aside.
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    {suggestions === null ? (
                        [0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)
                    ) : suggestions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
                            <Search size={22} className="mx-auto text-gray-300" />
                            <p className="mt-2 text-sm text-gray-600">No reviewer's expertise matches this proposal.</p>
                            <p className="mt-1 text-xs text-gray-400">Choose someone from the full reviewer list instead.</p>
                        </div>
                    ) : suggestions.map((s) => {
                        const flagged = s.conflicts?.length > 0 || s.at_capacity;
                        return (
                            <button key={s.id} type="button" onClick={() => setSelected(s)}
                                className={`w-full rounded-xl border p-3 text-left transition-colors ${selected?.id === s.id ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900">{s.title ? `${s.title} ` : ''}{s.name}</span>
                                    {s.is_external && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                            <Globe2 size={11} /> External{s.affiliation ? ` · ${s.affiliation}` : ''}
                                        </span>
                                    )}
                                    {s.at_capacity && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Full workload</span>}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Matches: {s.matched_terms.slice(0, 5).join(', ')}
                                    {' · '}{s.active_assignments} active review{s.active_assignments === 1 ? '' : 's'}
                                    {s.on_time_rate !== null ? ` · ${s.on_time_rate}% on time` : ' · new reviewer'}
                                </p>
                                {flagged && s.conflicts?.length > 0 && (
                                    <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
                                        <AlertTriangle size={11} className="mt-px shrink-0" /> Possible conflict: {s.conflicts.join('; ')}
                                    </p>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:items-end">
                    <div className="sm:w-48">
                        <label className="mb-1.5 block text-xs font-semibold text-gray-700">Due date</label>
                        <input type="date" value={dueDate} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div className="flex flex-1 justify-end gap-2">
                        <Link href="/admin/blind-review" className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Choose someone else</Link>
                        <button onClick={() => invite()} disabled={!selected || saving}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                            <UserPlus size={14} /> {saving ? 'Inviting…' : 'Invite'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Shown while a proposal's automatic blind-review decision is on hold because the
 * reviewers disagree: each reviewer's score, why it was held, and the two ways out.
 */
export default function ReviewDisagreementPanel({ proposal, canDecide, canInvite = false, onDecided }) {
    const { success, error } = useToast();
    const [deciding, setDeciding] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const d = proposal.review_disagreement;
    if (!d || !proposal.review_disagreement_flagged_at || proposal.review_disagreement_resolved_at) return null;

    const max = Math.max(...d.scores.map((s) => s.max), 1);
    const passMarkPct = Math.min(100, (d.pass_mark / max) * 100);

    const decide = async () => {
        if (notes.trim().length < 10) { error('Please explain the decision (at least 10 characters).'); return; }
        setSaving(true);
        try {
            const res = await post(`/proposals/${proposal.id}/blind-review/decide-disagreement`, { notes });
            success(res.message ?? 'Decision recorded.');
            setDeciding(false);
            onDecided?.();
        } catch (e) {
            error(e.response?.data?.message ?? 'Could not record the decision.');
        }
        setSaving(false);
    };

    return (
        <div className="mt-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50">
            <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Scale size={18} /></span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">Reviewers disagree — automatic decision on hold</p>
                    <ul className="mt-0.5 list-disc pl-4 text-xs leading-relaxed text-gray-600">
                        {d.reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                </div>
            </div>

            <div className="space-y-2.5 border-t border-amber-100 bg-white/70 px-4 py-3">
                {d.scores.map((s) => (
                    <div key={s.label} className="flex items-center gap-3 text-sm">
                        <span className="w-24 shrink-0 font-medium text-gray-700">{s.label}</span>
                        <div className="relative h-2 flex-1 rounded-full bg-gray-100">
                            <div className={`h-2 rounded-full ${s.passes ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${Math.min(100, (s.score / max) * 100)}%` }} />
                            <div className="absolute -top-1 h-4 w-0.5 bg-gray-700/60" style={{ left: `${passMarkPct}%` }} title={`Pass mark ${d.pass_mark}`} />
                        </div>
                        <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-gray-900">{s.score}/{s.max}</span>
                        {s.passes
                            ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                            : <XCircle size={15} className="shrink-0 text-red-500" />}
                    </div>
                ))}
                <p className="text-[11px] text-gray-400">Pass mark {d.pass_mark} · gap {d.spread} points ({d.spread_pct}% of the maximum, limit {d.threshold_pct}%)</p>
            </div>

            {d.second_opinion && (
                <div className="flex items-start gap-2 border-t border-amber-100 bg-white/70 px-4 py-3 text-xs text-gray-700">
                    <Hourglass size={14} className="mt-px shrink-0 text-indigo-500" />
                    <span>
                        Second opinion requested from <strong>{d.second_opinion.reviewer}</strong>
                        {d.second_opinion.due_date ? `, due ${new Date(d.second_opinion.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
                        {' '}When it's in, the two closest scores decide automatically.
                    </span>
                </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-amber-100 px-4 py-3">
                {canInvite && !d.second_opinion && (
                    <button
                        onClick={() => setInviting(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                    >
                        <UserPlus size={13} /> Get a second opinion
                    </button>
                )}
                {canDecide && (
                    <button
                        onClick={() => setDeciding(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                        <Gavel size={13} /> Decide with current scores
                    </button>
                )}
            </div>

            {inviting && (
                <SecondOpinionModal
                    proposal={proposal}
                    onClose={() => setInviting(false)}
                    onInvited={() => { setInviting(false); onDecided?.(); }}
                />
            )}

            {deciding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Gavel size={18} /></span>
                                <div>
                                    <h2 className="text-base font-bold text-gray-900">Decide With Current Scores</h2>
                                    <p className="text-xs text-gray-500">The usual pass/fail rule is applied to the average score.</p>
                                </div>
                            </div>
                            <button onClick={() => setDeciding(false)} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                        </div>
                        <div className="space-y-2 p-6">
                            <label className="block text-xs font-semibold text-gray-700">Moderation note <span className="text-red-500">*</span></label>
                            <textarea
                                rows={4}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Why the current scores are good enough to decide on (e.g. the low score is explained by…)"
                                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <p className="text-xs text-gray-400">Recorded in the workflow history with your name.</p>
                        </div>
                        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                            <button onClick={() => setDeciding(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                            <button onClick={decide} disabled={saving} className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                                {saving ? 'Deciding…' : 'Decide now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
