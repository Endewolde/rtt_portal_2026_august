import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { LifeBuoy, PlayCircle, ListChecks, Compass, BookOpen, SkipForward, Sparkles, RotateCcw } from 'lucide-react';
import { useOnboarding } from './OnboardingContext';
import { TOURS } from './tours';

/** The header Help button: resume, skip, start or replay tours, the checklist, and the Help Centre. */
export default function HelpMenu() {
    const onboarding = useOnboarding();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onClick);
        window.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onClick); window.removeEventListener('keydown', onKey); };
    }, [open]);

    if (!onboarding) return null;
    const { progress, tours, remaining, running, startTour, resumeTour, skipTour, openChecklist, openWelcome } = onboarding;
    const activeTour = progress?.active_tour && TOURS[progress.active_tour] ? progress.active_tour : null;
    const completed = progress?.completed_tours ?? [];
    const act = (fn) => () => { setOpen(false); fn(); };

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen((v) => !v)} data-tour="help-button" aria-label="Help and guided tours" aria-expanded={open}
                className="relative flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600">
                <LifeBuoy size={18} />
                <span className="hidden text-xs font-semibold lg:inline">Help</span>
                {remaining > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                        {remaining}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                    {running ? (
                        <div className="border-b border-gray-100 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Tour in progress</p>
                            <p className="mt-0.5 text-sm font-semibold text-gray-900">{TOURS[running.tourId]?.title}</p>
                            <button onClick={act(skipTour)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
                                <SkipForward size={12} /> Skip this tour
                            </button>
                        </div>
                    ) : activeTour && (
                        <button onClick={act(resumeTour)} className="flex w-full items-center gap-3 border-b border-gray-100 bg-indigo-50/60 px-4 py-3 text-left hover:bg-indigo-50">
                            <PlayCircle size={18} className="shrink-0 text-indigo-600" />
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-indigo-900">Resume tour</span>
                                <span className="block truncate text-xs text-indigo-700">{TOURS[activeTour].title} · step {(progress.active_step ?? 0) + 1}</span>
                            </span>
                        </button>
                    )}

                    <div className="py-1.5">
                        <button onClick={act(openChecklist)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <ListChecks size={16} className="text-gray-400" />
                            <span className="flex-1">Getting-started checklist</span>
                            {remaining > 0 && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{remaining} left</span>}
                        </button>
                        <button onClick={act(openWelcome)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <Sparkles size={16} className="text-gray-400" /> Welcome overview
                        </button>
                    </div>

                    <div className="border-t border-gray-100 py-1.5">
                        <p className="px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Guided tours</p>
                        {tours.map((id) => (
                            <button key={id} onClick={act(() => startTour(id))} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                                <Compass size={16} className={completed.includes(id) ? 'text-emerald-500' : 'text-gray-400'} />
                                <span className="min-w-0 flex-1 truncate">{TOURS[id].title}</span>
                                {completed.includes(id) && <RotateCcw size={12} className="text-gray-300" aria-label="Replay" />}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-gray-100 py-1.5">
                        <Link href="/help" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <BookOpen size={16} className="text-gray-400" /> Help Centre
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
