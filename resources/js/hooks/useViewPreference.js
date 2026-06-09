import { useState } from 'react';

export function useViewPreference(key, defaultView = 'card') {
    const storageKey = `rtt_view_${key}`;

    const [view, setView] = useState(() => {
        try { return localStorage.getItem(storageKey) || defaultView; }
        catch { return defaultView; }
    });

    const changeView = (newView) => {
        setView(newView);
        try { localStorage.setItem(storageKey, newView); } catch {}
    };

    return [view, changeView];
}
