import { ALWAYS_ROUTES, TOURS } from './tours';

const MOBILE_QUERY = '(max-width: 767px)';
export const isMobile = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

const isVisible = (node) => !!node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';

/** Find a target now: a selector, { text, tags }, or a list of either tried in order. */
export function findTarget(target) {
    if (!target) return null;
    const options = Array.isArray(target) ? target : [target];
    for (const option of options) {
        if (typeof option === 'string') {
            const node = [...document.querySelectorAll(option)].find(isVisible);
            if (node) return node;
        } else if (option?.text) {
            const wanted = option.text.toLowerCase();
            const node = [...document.querySelectorAll(`main ${option.tags ?? 'button,a'}`)]
                .find((n) => isVisible(n) && n.textContent.trim().toLowerCase().includes(wanted));
            if (node) return node;
        }
    }
    return null;
}

/** Wait for a target to appear (pages load their data after mounting). Resolves null on timeout. */
export function waitForTarget(target, timeout = 3500) {
    return new Promise((resolve) => {
        const started = Date.now();
        const tick = () => {
            const node = findTarget(target);
            if (node || Date.now() - started > timeout) return resolve(node);
            setTimeout(tick, 150);
        };
        tick();
    });
}

export const normalizePath = (path) => (path || '/').split('?')[0].replace(/\/+$/, '') || '/';

const routeAllowed = (route, allowedRoutes) => ALWAYS_ROUTES.includes(route) || allowedRoutes.has(route);

/**
 * The steps of a tour this user may see. Menu and page steps are kept only for
 * routes in the user's own sidebar (or open to everyone), so a tour never leads to
 * a page their role can't open.
 */
export function availableSteps(tourId, allowedRoutes) {
    const tour = TOURS[tourId];
    if (!tour) return [];

    const kept = [];
    let page = null; // the page the tour is on at this point, if the user may open it
    for (const step of tour.steps) {
        if (step.desktopOnly && isMobile()) continue;
        if (step.kind === 'nav') {
            if (allowedRoutes.has(step.href)) kept.push(step);
        } else if (step.kind === 'page') {
            page = routeAllowed(step.route, allowedRoutes) ? step.route : false;
            if (page) kept.push(step);
        } else if (isLayoutTarget(step.target)) {
            kept.push(step); // header and sidebar elements exist on every page
        } else if (page) {
            kept.push({ ...step, route: page }); // a part of the page the tour just opened
        }
    }
    return kept;
}

/** Header and sidebar elements carry data-tour markers and are on every page. */
const isLayoutTarget = (target) => typeof target === 'string' && target.startsWith('[data-tour="') && !target.includes('page-title');

/** A tour is offered only if most of it applies to this user — at least two steps. */
export const tourAvailable = (tourId, allowedRoutes) => availableSteps(tourId, allowedRoutes).length >= 2;

export const taskAvailable = (task, allowedRoutes) =>
    (!task.route || routeAllowed(task.route, allowedRoutes))
    && (!task.tour || tourAvailable(task.tour, allowedRoutes));

/** The page a step must be shown on, or null for any page. */
export const stepRoute = (step) => step.route ?? null;

// Run state survives a page change (each page mounts its own layout).
const RUN_KEY = 'rtt_onboarding_run';
export const saveRun = (run) => { try { sessionStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch { /* storage unavailable */ } };
export const loadRun = () => { try { return JSON.parse(sessionStorage.getItem(RUN_KEY)); } catch { return null; } };
export const clearRun = () => { try { sessionStorage.removeItem(RUN_KEY); } catch { /* storage unavailable */ } };
