import { useEffect } from 'react';
import { translate as tr, Trans } from '../lib/i18n'
import { Sparkles, CheckCircle2, PlayCircle, ListChecks, X } from 'lucide-react';
import { useOnboarding } from './OnboardingContext';

/** First sign-in welcome, personalised to the user's role. */
export default function WelcomeModal({ user, onStart, onLater, onSkipAll, onChecklist }) {
    const { config, tours, checklist } = useOnboarding();
    const firstName = (user?.name ?? '').split(' ')[0];

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onLater(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onLater]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="welcome-title"
                className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
                <div className="relative overflow-hidden bg-linear-to-br from-indigo-600 via-violet-600 to-indigo-700 px-6 pb-7 pt-6 text-white">
                    <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
                    <div className="pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-white/5" />
                    <button onClick={onLater} aria-label={tr("Close")} className="absolute right-4 top-4 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                        <X size={16} />
                    </button>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                        <Sparkles size={12} /> {config.label}
                    </span>
                    {firstName && <p className="mt-3 text-sm font-medium text-indigo-100">{tr("Hi :firstName 👋", { firstName: firstName })}</p>}
                    <h2 id="welcome-title" className="mt-1 text-2xl font-bold leading-tight">{config.welcomeTitle}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-indigo-100">{config.welcomeText}</p>
                </div>

                <div className="space-y-5 px-6 py-5">
                    <div>
                        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{tr("What you can do here")}</p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                            {config.highlights.map((h) => (
                                <li key={h} className="flex items-start gap-2 text-sm text-gray-700">
                                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" /> {h}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                        <ListChecks size={18} className="shrink-0 text-indigo-600" />
                        <p className="text-xs leading-relaxed text-indigo-900">
                            {tr(':tours short guided tour(s) and a :steps-step checklist will get you going.', { tours: tours.length, steps: checklist.length })}{' '}
                            <Trans text="You can pause and pick up again any time from the <b>Help</b> button at the top." />
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:flex-row-reverse sm:items-center">
                    <button onClick={onStart} autoFocus
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-700">
                        <PlayCircle size={16} /> {tr("Take the tour")}
                    </button>
                    <button onClick={onChecklist}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <ListChecks size={15} /> {tr("See my checklist")}
                    </button>
                    <div className="flex justify-center gap-4 sm:mr-auto sm:justify-start">
                        <button onClick={onLater} className="text-xs font-medium text-gray-500 hover:text-gray-700">{tr("Later")}</button>
                        <button onClick={onSkipAll} className="text-xs font-medium text-gray-400 hover:text-gray-600">{tr("Don't show again")}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
