import { useEffect, useState } from 'react';
import { translate as tr } from '../lib/i18n'
import { Sparkles, Lock, CheckCircle2, AlertTriangle, Lightbulb, RefreshCw, ListChecks, Wallet } from 'lucide-react';
import { get, post } from '../lib/api';
import { useToast } from './Toast';

const READINESS = {
    ready: { label: 'Looks ready', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
    almost: { label: 'Almost there', className: 'border-amber-200 bg-amber-50 text-amber-800', icon: Lightbulb },
    needs_work: { label: 'Needs more work', className: 'border-rose-200 bg-rose-50 text-rose-800', icon: AlertTriangle },
};

const timeAgo = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * "Check my proposal": private AI feedback against the call's real scoring criteria,
 * before submission. Only the research team sees it; it never reaches reviewers.
 */
export default function AiWritingCoach({ proposalId }) {
    const { error } = useToast();
    const [state, setState] = useState(null);
    const [running, setRunning] = useState(false);

    const load = () => get(`/proposals/${proposalId}/ai-coach`).then((r) => setState(r.data)).catch(() => setState(null));
    useEffect(() => { if (proposalId) load(); }, [proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!state || !state.enabled || !state.available || !state.can_request) return null;

    const run = async () => {
        setRunning(true);
        try {
            const res = await post(`/proposals/${proposalId}/ai-coach`, {}, { skipErrorToast: true });
            setState((s) => ({ ...s, latest: res.data, used_today: s.used_today + 1 }));
        } catch (e) {
            error(e.response?.data?.message ?? 'The writing coach could not run. Please try again.');
        }
        setRunning(false);
    };

    const result = state.latest?.result;
    const readiness = result ? READINESS[result.readiness] ?? READINESS.almost : null;
    const limitReached = state.used_today >= state.daily_limit;

    return (
        <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white">
            <header className="flex flex-col gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Sparkles size={17} /></span>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">{tr("Check my proposal")}</h3>
                        <p className="flex items-center gap-1 text-xs text-gray-500"><Lock size={11} /> {tr("Private AI feedback against the call's scoring criteria. Reviewers never see it, and it doesn't affect your score.")}</p>
                    </div>
                </div>
                <button onClick={run} disabled={running || limitReached}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {running ? <><RefreshCw size={14} className="animate-spin" /> {tr("Reading your proposal…")}</> : <><Sparkles size={14} /> {result ? 'Check again' : 'Check my proposal'}</>}
                </button>
            </header>

            {running && !result && (
                <div className="space-y-2 px-5 py-4">{[0, 1, 2].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-gray-100" style={{ width: `${90 - i * 15}%` }} />)}</div>
            )}

            {result && (
                <div className={`space-y-4 px-5 py-4 ${running ? 'opacity-50' : ''}`}>
                    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${readiness.className}`}>
                        <readiness.icon size={16} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold">{readiness.label}</p>
                            <p className="mt-0.5 text-sm leading-relaxed">{result.overall}</p>
                        </div>
                    </div>

                    {result.criteria.length > 0 && (
                        <div>
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"><ListChecks size={13} /> {tr("Against each criterion")}</p>
                            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                                {result.criteria.map((c, i) => (
                                    <li key={i} className="px-4 py-3">
                                        <p className="text-xs font-medium text-gray-500">{c.criterion}</p>
                                        <p className="mt-1 text-sm text-gray-800">{c.assessment}</p>
                                        {c.suggestion && <p className="mt-1 flex items-start gap-1.5 text-sm text-violet-800"><Lightbulb size={13} className="mt-0.5 shrink-0" /> {c.suggestion}</p>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                        {result.missing.length > 0 && (
                            <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3">
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700">{tr("Missing")}</p>
                                <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">{result.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
                            </div>
                        )}
                        {result.strengths.length > 0 && (
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{tr("Strengths")}</p>
                                <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">{result.strengths.map((m, i) => <li key={i}>{m}</li>)}</ul>
                            </div>
                        )}
                    </div>

                    {result.budget && (
                        <p className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"><Wallet size={14} className="mt-0.5 shrink-0 text-gray-400" /> {result.budget}</p>
                    )}

                    <p className="text-[11px] text-gray-400">
                        Checked {timeAgo(state.latest.created_at)}{state.latest.requested_by ? ` by ${state.latest.requested_by}` : ''} · {state.used_today} of {state.daily_limit} checks used today · AI can be wrong — use it as a second opinion, not a rule.
                    </p>
                </div>
            )}
        </section>
    );
}
