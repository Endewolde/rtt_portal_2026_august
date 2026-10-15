import { useState, useEffect } from 'react';
import { Check, X, Compass, AlertCircle, ArrowRight, Clock } from 'lucide-react';
import { get } from '../lib/api';
import { useT, useLanguage } from '../lib/i18n';

const DOT = {
    done:     'bg-emerald-500 text-white',
    current:  'bg-blue-600 text-white ring-4 ring-blue-100',
    stopped:  'bg-red-500 text-white',
    skipped:  'bg-gray-100 text-gray-300',
    upcoming: 'bg-gray-100 text-gray-400',
};

/** "Where is my proposal and what do I do next" — shown to the research team at the top of the proposal page. */
export default function ProposalStatusGuide({ proposalId, status, onOpenTab }) {
    const t = useT();
    const [lang] = useLanguage();
    const [guide, setGuide] = useState(null);

    useEffect(() => {
        get(`/proposals/${proposalId}/status-guide`).then((r) => setGuide(r.data)).catch(() => setGuide(null));
    }, [proposalId, status, lang]);

    if (!guide) return null;

    const rejected = guide.status === 'rejected';

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {/* Journey */}
            <ol className="flex items-start gap-1 overflow-x-auto border-b border-gray-100 px-5 pb-4 pt-5">
                {guide.steps.map((step, i) => (
                    <li key={step.key} className="flex min-w-[5.5rem] flex-1 flex-col items-center text-center">
                        <div className="flex w-full items-center">
                            <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : step.state === 'done' || step.state === 'current' || step.state === 'stopped' ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${DOT[step.state]}`}>
                                {step.state === 'done' ? <Check size={14} /> : step.state === 'stopped' ? <X size={14} /> : i + 1}
                            </span>
                            <span className={`h-0.5 flex-1 ${i === guide.steps.length - 1 ? 'opacity-0' : step.state === 'done' ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                        </div>
                        <span className={`mt-1.5 text-[11px] leading-tight ${step.state === 'current' ? 'font-semibold text-blue-700' : step.state === 'stopped' ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                            {t(step.label)}
                        </span>
                    </li>
                ))}
            </ol>

            {/* Now */}
            <div className="flex gap-3 px-5 py-4">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${rejected ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
                    {rejected ? <AlertCircle size={18} /> : <Compass size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{guide.headline}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{guide.explanation}</p>
                    {guide.typical_days && guide.days_in_stage !== null && (
                        <p className={`mt-1.5 inline-flex items-center gap-1 text-xs ${guide.taking_longer ? 'text-amber-700' : 'text-gray-400'}`}>
                            <Clock size={12} />
                            {t(guide.days_in_stage === 1 ? '1 day at this step · usually about :typical days' : ':days days at this step · usually about :typical days', { days: guide.days_in_stage, typical: guide.typical_days })}
                            {guide.taking_longer && t(' — taking longer than usual')}
                        </p>
                    )}
                </div>
            </div>

            {/* What you need to do */}
            {guide.actions.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('What you need to do')}</p>
                    <ul className="space-y-2">
                        {guide.actions.map((a) => (
                            <li key={a.label} className={`flex flex-wrap items-center gap-3 rounded-lg border bg-white px-3 py-2.5 ${a.urgent ? 'border-red-200' : 'border-gray-200'}`}>
                                {a.urgent && <AlertCircle size={15} className="shrink-0 text-red-500" />}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900">{a.label}</p>
                                    {a.detail && <p className="text-xs text-gray-500">{a.detail}</p>}
                                </div>
                                {a.tab && onOpenTab && (
                                    <button onClick={() => onOpenTab(a.tab)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
                                        {t('Open')} <ArrowRight size={12} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
