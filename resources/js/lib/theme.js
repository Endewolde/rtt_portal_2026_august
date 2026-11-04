import { useEffect, useState } from 'react';
import api from './api';

/**
 * Each person's theme. It is saved on their account (users.theme) so it follows them
 * between devices, and kept on the device too so the page is drawn in the right theme
 * before anything loads (see the inline script in app.blade.php). No personal choice
 * means the organisation's theme from Settings → Appearance.
 */
const STORAGE_KEY = 'rtt_theme';
const THEMES = ['light', 'dark', 'system'];
const listeners = new Set();

export const THEME_OPTIONS = [
    { value: null, label: 'Organisation default' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
];

/** The person's own choice on this device, or null when they follow the organisation. */
export function getThemePreference() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return THEMES.includes(saved) ? saved : null;
    } catch {
        return null;
    }
}

/** The organisation's theme, recorded on the page by the inline script in app.blade.php. */
const organisationDefault = () => (typeof document !== 'undefined' ? document.documentElement.dataset.orgTheme : null);

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** Light or dark pages for a preference, falling back to the organisation's theme. */
export function applyTheme(preference, organisationTheme = organisationDefault()) {
    const theme = preference || (THEMES.includes(organisationTheme) ? organisationTheme : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark()));
    document.documentElement.dataset.theme = theme;
}

function remember(preference) {
    try {
        if (preference) localStorage.setItem(STORAGE_KEY, preference);
        else localStorage.removeItem(STORAGE_KEY);
    } catch { /* private mode */ }
    listeners.forEach((fn) => fn(preference));
}

/** Bring the device in line with the account — after login, or when the user is reloaded. */
export function syncThemeFromUser(user, organisationTheme = organisationDefault()) {
    const preference = THEMES.includes(user?.theme) ? user.theme : null;
    if (preference !== getThemePreference()) {
        remember(preference);
    }
    applyTheme(preference, organisationTheme);
}

/** Forget the device copy — on sign-out, so the next person starts on the organisation theme. */
export function clearThemePreference(organisationTheme = organisationDefault()) {
    remember(null);
    applyTheme(null, organisationTheme);
}

/** Change the theme now and save it to the account. */
export async function setThemePreference(preference, organisationTheme = organisationDefault()) {
    const previous = getThemePreference();
    remember(preference);
    applyTheme(preference, organisationTheme);
    try {
        await api.put('/auth/profile', { theme: preference });
        try {
            const user = JSON.parse(localStorage.getItem('rtt_user') || 'null');
            if (user) localStorage.setItem('rtt_user', JSON.stringify({ ...user, theme: preference }));
        } catch { /* ignore */ }
        return true;
    } catch {
        remember(previous);
        applyTheme(previous, organisationTheme);
        return false;
    }
}

export function useThemePreference() {
    const [preference, setPreference] = useState(getThemePreference);
    useEffect(() => {
        listeners.add(setPreference);
        return () => listeners.delete(setPreference);
    }, []);
    return preference;
}
