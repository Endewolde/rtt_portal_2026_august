import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Scale, UserPlus, Gavel, X, CheckCircle2, XCircle } from 'lucide-react';
import { post } from '../lib/api';
import { useToast } from './Toast';

/**
 * Shown while a proposal's automatic blind-review decision is on hold because the
 * reviewers disagree: each reviewer's score, why it was held, and the two ways out.
 */
export default function ReviewDisagreementPanel({ proposal, canDecide, onDecided }) {
    const { success, error } = useToast();
    const [deciding, setDeciding] = useState(false);
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

            <div className="flex flex-wrap justify-end gap-2 border-t border-amber-100 px-4 py-3">
                <Link
                    href="/admin/blind-review"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                >
                    <UserPlus size={13} /> Add another reviewer
                </Link>
                {canDecide && (
                    <button
                        onClick={() => setDeciding(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                        <Gavel size={13} /> Decide with current scores
                    </button>
                )}
            </div>

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
