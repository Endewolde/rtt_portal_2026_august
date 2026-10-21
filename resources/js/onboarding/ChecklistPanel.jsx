import { useEffect } from 'react';
import {
    X, CheckCircle2, Circle, PlayCircle, RotateCcw, ArrowRight, Sparkles, Map as MapIcon, Undo2, Radar,
} from 'lucide-react';
import { useOnboarding } from './OnboardingContext';
import { TOURS, ROLES, isTaskDone } from './tours';

/** The persistent getting-started checklist and the list of guided tours, for the current role. */
export default function ChecklistPanel() {
    const {
        progress, config, tours, checklist, readOnly,
        startTour, resumeTour, restartAll, switchRole, closeChecklist, toggleTask, goTo,
    } = useOnboarding();

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') closeChecklist(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [closeChecklist]);

    if (!progress) return null;

    const done = checklist.filter((t) => isTaskDone(t, progress)).length;
    const pct = checklist.length ? Math.round((done / checklist.length) * 100) : 0;
    const roles = (progress.roles ?? []).filter((r) => r !== 'general' || progress.roles.length === 1);
    const completedTours = progress.completed_tours ?? [];
    const activeTour = progress.active_tour && TOURS[progress.active_tour] ? progress.active_tour : null;

    return (
        <div className="fixed inset-0 z-[55] flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={closeChecklist}>
            <aside role="dialog" aria-modal="true" aria-label="Getting started"
                className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="relative overflow-hidden bg-linear-to-br from-indigo-600 to-violet-600 px-6 pb-5 pt-5 text-white">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-100"><Sparkles size={12} /> Getting started</p>
                            <h2 className="mt-1 text-lg font-bold">{config.label}</h2>
                        </div>
                        <button onClick={closeChecklist} aria-label="Close" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
                            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums">{done}/{checklist.length}</span>
                    </div>
                    {roles.length > 1 && (
                        <div className="mt-4 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Role">
                            {roles.map((r) => (
                                <button key={r} role="tab" aria-selected={r === progress.role} onClick={() => switchRole(r)}
                                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${r === progress.role ? 'bg-white text-indigo-700' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                                    {(ROLES[r] ?? ROLES.general).label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                    {activeTour && (
                        <button onClick={resumeTour}
                            className="flex w-full items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left hover:bg-indigo-100">
                            <PlayCircle size={20} className="shrink-0 text-indigo-600" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-indigo-900">Resume “{TOURS[activeTour].title}”</span>
                                <span className="block text-xs text-indigo-700">Pick up at step {(progress.active_step ?? 0) + 1}</span>
                            </span>
                            <ArrowRight size={16} className="text-indigo-500" />
                        </button>
                    )}

                    {/* Checklist */}
                    <section>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Your checklist</h3>
                        <ul className="space-y-2">
                            {checklist.map((task) => {
                                const isDone = isTaskDone(task, progress);
                                const detected = isDone && !(progress.completed_tasks ?? []).includes(task.id);
                                return (
                                    <li key={task.id} className={`rounded-2xl border px-4 py-3 transition-colors ${isDone ? 'border-emerald-100 bg-emerald-50/50' : 'border-gray-200 bg-white'}`}>
                                        <div className="flex items-start gap-3">
                                            {isDone
                                                ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                                                : <Circle size={18} className="mt-0.5 shrink-0 text-gray-300" />}
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-semibold ${isDone ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900'}`}>{task.title}</p>
                                                <p className="mt-0.5 text-xs text-gray-500">{task.description}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    {!isDone && task.tour && (
                                                        <button onClick={() => startTour(task.tour)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700">
                                                            <PlayCircle size={12} /> Start tour
                                                        </button>
                                                    )}
                                                    {!isDone && task.route && (
                                                        <button onClick={() => goTo(task.route)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50">
                                                            Go there <ArrowRight size={11} />
                                                        </button>
                                                    )}
                                                    {!isDone && !task.tour && !readOnly && (
                                                        <button onClick={() => toggleTask(task, true)} className="text-[11px] font-medium text-gray-400 hover:text-gray-600">Mark as done</button>
                                                    )}
                                                    {detected && task.signal && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Radar size={11} /> Detected from your activity</span>
                                                    )}
                                                    {isDone && (progress.completed_tasks ?? []).includes(task.id) && !readOnly && (
                                                        <button onClick={() => toggleTask(task, false)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600"><Undo2 size={11} /> Undo</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    {/* Tours */}
                    <section>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Guided tours</h3>
                        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
                            {tours.map((id) => {
                                const finished = completedTours.includes(id);
                                const inProgress = activeTour === id;
                                return (
                                    <li key={id} className="flex items-center gap-3 px-4 py-3">
                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${finished ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {finished ? <CheckCircle2 size={17} /> : <MapIcon size={17} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-gray-900">{TOURS[id].title}</p>
                                            <p className="truncate text-xs text-gray-500">{TOURS[id].summary}</p>
                                        </div>
                                        <button onClick={() => (inProgress ? resumeTour() : startTour(id))}
                                            className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                            {inProgress ? 'Resume' : finished ? 'Replay' : 'Start'}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>

                {!readOnly && (
                    <div className="border-t border-gray-100 px-6 py-3.5">
                        <button onClick={restartAll} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800">
                            <RotateCcw size={13} /> Restart onboarding for this role
                        </button>
                    </div>
                )}
            </aside>
        </div>
    );
}
