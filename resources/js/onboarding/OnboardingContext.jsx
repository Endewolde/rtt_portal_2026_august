import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { get, patch, post } from '../lib/api';
import { useToast } from '../Components/Toast';
import { TOURS, roleConfig, isTaskDone } from './tours';
import {
    availableSteps, clearRun, isMobile, loadRun, normalizePath, saveRun,
    stepRoute, taskAvailable, tourAvailable, waitForTarget,
} from './engine';
import WelcomeModal from './WelcomeModal';
import ChecklistPanel from './ChecklistPanel';

const OnboardingContext = createContext(null);

// Kept between page visits (the layout remounts on each one); refreshed when the checklist opens.
let cache = null; // { userId, data }

export const useOnboarding = () => useContext(OnboardingContext);

/**
 * Role-based onboarding for the signed-in user: the first-login welcome, guided
 * tours across pages, and the getting-started checklist. Progress is saved per
 * user and role on the server; a tour that moves to another page continues there.
 *
 * @param {Set<string>} allowedRoutes  hrefs in the user's own sidebar — the limit of what tours may show
 * @param {(href: string) => void} revealNav  expand the menu group (and open the mobile drawer) for an item
 * @param {() => void} hideMobileNav  close the mobile drawer
 * @param {boolean} readOnly  true while impersonating: show nothing automatically, save nothing
 * @param {boolean} suspended  another first-login dialog is open — hold the welcome until it closes
 */
export function OnboardingProvider({ user, allowedRoutes, revealNav, hideMobileNav, readOnly = false, suspended = false, children }) {
    const [progress, setProgress] = useState(null);
    const [role, setRole] = useState(null);
    const [welcomeOpen, setWelcomeOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [running, setRunning] = useState(null); // { tourId, index }

    const { success } = useToast();
    const driverRef = useRef(null);
    const closingByUs = useRef(false);
    const runToken = useRef(0);

    const config = roleConfig(progress?.role);

    const tours = useMemo(
        () => (config.tours ?? []).filter((id) => TOURS[id] && tourAvailable(id, allowedRoutes)),
        [config, allowedRoutes],
    );
    const checklist = useMemo(
        () => (config.checklist ?? []).filter((task) => taskAvailable(task, allowedRoutes)),
        [config, allowedRoutes],
    );
    const remaining = progress ? checklist.filter((t) => !isTaskDone(t, progress)).length : 0;

    // ── Server progress ────────────────────────────────────────────────────────
    const remember = (data) => {
        if (data) cache = { userId: user?.id, data };
        return data;
    };

    const load = useCallback(async (forRole, fresh = false) => {
        if (!fresh && cache?.userId === user?.id && (!forRole || cache.data.role === forRole)) {
            setProgress(cache.data);
            setRole(cache.data.role);
            return cache.data;
        }
        try {
            const res = await get('/onboarding', forRole ? { role: forRole } : {});
            setProgress(remember(res.data));
            setRole(res.data.role);
            return res.data;
        } catch {
            return null;
        }
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = useCallback(async (change, forRole = role) => {
        if (readOnly || !forRole) return null;
        try {
            const res = await patch('/onboarding', { role: forRole, ...change });
            remember(res.data);
            setProgress((p) => (p && p.role !== res.data.role ? p : res.data));
            return res.data;
        } catch {
            return null;
        }
    }, [readOnly, role]);

    useEffect(() => {
        if (!user?.id) return;
        const run = loadRun();
        load(run?.role).then((data) => {
            if (!data) return;
            if (run && TOURS[run.tourId]) {
                resume(run.tourId, run.index, data.role);
            } else if (!readOnly && !data.welcome_seen && !data.dismissed) {
                setWelcomeOpen(true);
            }
        });
        return () => { runToken.current++; destroyDriver(); };
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Tour engine ────────────────────────────────────────────────────────────
    const destroyDriver = () => {
        if (driverRef.current) {
            closingByUs.current = true;
            driverRef.current.destroy();
            driverRef.current = null;
            closingByUs.current = false;
        }
    };

    const ensureDriver = () => {
        if (driverRef.current) return driverRef.current;
        driverRef.current = driver({
            animate: true,
            smoothScroll: true,
            allowClose: true,
            allowKeyboardControl: false,
            overlayColor: '#0f172a',
            overlayOpacity: 0.55,
            stagePadding: 6,
            stageRadius: 12,
            popoverClass: 'rtt-tour',
            popoverOffset: 12,
            onDestroyed: () => {
                driverRef.current = null;
                if (!closingByUs.current) pauseTour(); // overlay click or the × button
            },
        });
        return driverRef.current;
    };

    const finishTour = useCallback(async (tourId, forRole) => {
        runToken.current++;
        clearRun();
        destroyDriver();
        setRunning(null);
        const updated = await save({ completed_tour: tourId }, forRole);
        const done = updated?.completed_tours ?? [tourId];
        const next = tours.find((id) => !done.includes(id));
        success(next ? `Next up: “${TOURS[next].title}” — find it under Help.` : 'You\'ve seen every tour for your role. Help is always one click away.', {
            title: `“${TOURS[tourId].title}” complete`,
            ...(next ? { action: { label: 'Start now', onClick: () => showStepRef.current?.(next, 0, forRole) } } : {}),
        });
    }, [save, success, tours]); // eslint-disable-line react-hooks/exhaustive-deps

    const pauseTour = useCallback(() => {
        runToken.current++;
        clearRun();
        setRunning(null);
        hideMobileNav?.();
    }, [hideMobileNav]);

    const showStep = useCallback(async (tourId, index, forRole) => {
        const steps = availableSteps(tourId, allowedRoutes);
        if (index >= steps.length) return finishTour(tourId, forRole);
        if (index < 0) index = 0;

        const token = ++runToken.current;
        const step = steps[index];
        const route = stepRoute(step);
        setRunning({ tourId, index, total: steps.length });
        saveRun({ role: forRole, tourId, index });
        save({ active_tour: tourId, active_step: index }, forRole);

        // A step on another page: go there; the tour continues when it loads.
        if (route && normalizePath(window.location.pathname) !== normalizePath(route)) {
            destroyDriver();
            hideMobileNav?.();
            router.visit(route);
            return;
        }

        let target = step.target;
        let description = step.description;
        if (step.kind === 'nav') {
            revealNav?.(step.href);
            target = `[data-tour="nav:${step.href}"]`;
            // Let the menu group (and the mobile drawer) finish opening before measuring.
            await new Promise((r) => setTimeout(r, 260));
            if (token !== runToken.current) return;
        } else {
            hideMobileNav?.();
            if (isMobile() && step.mobileTarget) {
                target = step.mobileTarget;
                description = step.mobileDescription ?? description;
            }
        }

        const element = await waitForTarget(target, step.kind === 'nav' ? 1500 : 3500);
        if (token !== runToken.current) return; // the user moved on meanwhile

        const isLast = index === steps.length - 1;
        const d = ensureDriver();
        d.highlight({
            element: element ?? undefined,
            popover: {
                title: step.title,
                description,
                side: step.kind === 'nav' ? 'right' : undefined,
                showButtons: ['previous', 'next', 'close'],
                disableButtons: index === 0 ? ['previous'] : [],
                prevBtnText: 'Back',
                nextBtnText: isLast ? 'Finish' : 'Next',
                onPopoverRender: (popover) => {
                    const meta = document.createElement('div');
                    meta.className = 'rtt-tour-meta';
                    meta.innerHTML = `<span>${TOURS[tourId].title}</span><span>${index + 1} of ${steps.length}</span>`;
                    popover.wrapper.prepend(meta);
                    const bar = document.createElement('div');
                    bar.className = 'rtt-tour-bar';
                    bar.innerHTML = `<span style="width:${((index + 1) / steps.length) * 100}%"></span>`;
                    popover.wrapper.prepend(bar);
                },
                onNextClick: () => showStep(tourId, index + 1, forRole),
                onPrevClick: () => showStep(tourId, index - 1, forRole),
                onCloseClick: () => { destroyDriver(); pauseTour(); },
            },
        });
    }, [allowedRoutes, revealNav, hideMobileNav, save, finishTour, pauseTour]); // eslint-disable-line react-hooks/exhaustive-deps

    const showStepRef = useRef(null);
    showStepRef.current = showStep;

    const resume = useCallback((tourId, index, forRole) => {
        // Let the page render before looking for its elements.
        setTimeout(() => showStep(tourId, index ?? 0, forRole), 350);
    }, [showStep]);

    // Arrow keys and Escape while a tour runs.
    useEffect(() => {
        if (!running) return;
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
            if (e.key === 'ArrowRight') showStep(running.tourId, running.index + 1, role);
            if (e.key === 'ArrowLeft' && running.index > 0) showStep(running.tourId, running.index - 1, role);
            if (e.key === 'Escape') { destroyDriver(); pauseTour(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [running, role, showStep, pauseTour]);

    // ── Public actions ─────────────────────────────────────────────────────────
    const startTour = useCallback((tourId, fromStep = 0) => {
        setPanelOpen(false);
        setWelcomeOpen(false);
        if (!readOnly && progress && !progress.welcome_seen) save({ welcome_seen: true });
        showStep(tourId, fromStep, role);
    }, [readOnly, progress, role, save, showStep]);


    const value = {
        progress, role, config, tours, checklist, remaining, running, readOnly,
        startTour,
        resumeTour: () => progress?.active_tour && startTour(progress.active_tour, progress.active_step ?? 0),
        skipTour: () => { destroyDriver(); pauseTour(); save({ active_tour: null }); },
        restartAll: async () => {
            destroyDriver(); pauseTour();
            if (readOnly) return;
            const res = await post('/onboarding/reset', { role });
            setProgress(remember(res.data));
            setPanelOpen(false);
            setWelcomeOpen(true);
        },
        switchRole: (r) => load(r, true),
        openChecklist: () => { load(role, true); setPanelOpen(true); },
        closeChecklist: () => setPanelOpen(false),
        openWelcome: () => setWelcomeOpen(true),
        toggleTask: (task, done) => save(done ? { completed_tasks: [task.id] } : { uncompleted_task: task.id }),
        goTo: (route) => { setPanelOpen(false); router.visit(route); },
    };

    return (
        <OnboardingContext.Provider value={value}>
            {children}
            {welcomeOpen && progress && !suspended && (
                <WelcomeModal
                    user={user}
                    onStart={() => startTour(tours[0] ?? 'basics')}
                    onLater={() => { setWelcomeOpen(false); save({ welcome_seen: true }); }}
                    onSkipAll={() => { setWelcomeOpen(false); save({ dismissed: true }); }}
                    onChecklist={() => { setWelcomeOpen(false); save({ welcome_seen: true }); setPanelOpen(true); }}
                />
            )}
            {panelOpen && <ChecklistPanel />}
        </OnboardingContext.Provider>
    );
}
