import { useEffect, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, ThumbsUp, AlertTriangle, Scale, RefreshCw, Info } from 'lucide-react';
import { get, post } from '../lib/api';
import { useToast } from './Toast';

function Sources({ sources }) {
    return (
        <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
            {sources.map((s) => (
                <span key={s} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{s}</span>
            ))}
        </span>
    );
}

function Block({ icon: Icon, title, tone, items, render }) {
    if (!items?.length) return null;
    return (
        <div>
            <p className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}><Icon size={13} /> {title}</p>
            <ul className="space-y-1.5">{items.map((item, i) => <li key={i} className="text-sm leading-relaxed text-gray-700">{render(item)}</li>)}</ul>
        </div>
    );
}

/**
 * Central committee aid: all reviewer and panel comments condensed into strengths,
 * concerns and disagreements, each tagged with who raised it. Advisory only.
 */
export default function AiReviewSummary({ proposalId, defaultOpen = false }) {
    const { error } = useToast();
    const [open, setOpen] = useState(defaultOpen);
    const [state, setState] = useState(null);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        if (open && !state) get(`/proposals/${proposalId}/ai-review-summary`).then((r) => setState(r.data)).catch(() => setState({ enabled: false }));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const run = async () => {
        setRunning(true);
        try {
            const res = await post(`/proposals/${proposalId}/ai-review-summary`, {}, { skipErrorToast: true });
            setState((s) => ({ ...s, latest: res.data, stale: false }));
        } catch (e) {
            error(e.response?.data?.message ?? 'The summary could not be created. Please try again.');
        }
        setRunning(false);
    };

    const result = state?.latest?.result;
    const tally = Object.entries(result?.recommendations ?? {});

    return (
        <div className="rounded-xl border border-violet-100 bg-violet-50/30">
            <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-violet-700 hover:text-violet-900">
                <Sparkles size={13} /> AI summary of the reviews
                <span className="font-normal text-gray-400">— strengths, concerns and disagreements</span>
                {open ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
            </button>

            {open && (
                <div className="space-y-4 border-t border-violet-100 bg-white px-4 py-4">
                    {!state ? (
                        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                    ) : !state.enabled || !state.available ? (
                        <p className="text-xs text-gray-500">The AI review summary is not available — it is switched off in Settings or no AI provider is configured.</p>
                    ) : state.reviews === 0 ? (
                        <p className="text-xs text-gray-500">No submitted reviews to summarise yet.</p>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-gray-500">
                                    {result ? `Based on ${state.reviews} submitted review${state.reviews === 1 ? '' : 's'}.` : `${state.reviews} submitted review${state.reviews === 1 ? '' : 's'} can be summarised.`}
                                    {state.stale && <span className="ml-1 font-semibold text-amber-700">New reviews have arrived since this summary.</span>}
                                </p>
                                <button onClick={run} disabled={running}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                                    <RefreshCw size={12} className={running ? 'animate-spin' : ''} /> {running ? 'Summarising…' : result ? 'Refresh' : 'Summarise reviews'}
                                </button>
                            </div>

                            {result && (
                                <div className={`space-y-4 ${running ? 'opacity-50' : ''}`}>
                                    <p className="text-sm leading-relaxed text-gray-800">{result.summary}</p>
                                    {tally.length > 0 && (
                                        <p className="text-xs text-gray-500">
                                            Recommendations: {tally.map(([rec, n]) => `${n} × ${rec.replace(/_/g, ' ')}`).join(' · ')}
                                        </p>
                                    )}
                                    <Block icon={ThumbsUp} title="Strengths" tone="text-emerald-700" items={result.strengths} render={(i) => <>{i.point}<Sources sources={i.sources} /></>} />
                                    <Block icon={AlertTriangle} title="Concerns" tone="text-rose-700" items={result.concerns} render={(i) => <>{i.point}<Sources sources={i.sources} /></>} />
                                    <Block icon={Scale} title="Where reviewers disagree" tone="text-amber-700" items={result.disagreements} render={(i) => <><span className="font-medium">{i.topic}:</span> {i.detail}<Sources sources={i.sources} /></>} />
                                    <p className="flex items-start gap-1.5 text-[11px] text-gray-400">
                                        <Info size={12} className="mt-px shrink-0" /> AI-generated from the reviewers' own scores and comments; every point names who raised it. Advisory only — read the full reviews before deciding.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
