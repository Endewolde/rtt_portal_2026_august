import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

/**
 * Polls /action-counts every 60 s and returns an object of pending-action counts
 * used to drive notification badges on sidebar nav items.
 */
export function useActionCounts() {
    const [counts, setCounts] = useState({});

    const fetch = useCallback(async () => {
        const token = localStorage.getItem('rtt_token');
        if (!token) return;
        try {
            const r = await api.get('/action-counts');
            setCounts(r.data?.data ?? {});
        } catch {
            // silently swallow — badges are non-critical UI
        }
    }, []);

    useEffect(() => {
        // Stagger 2 s from mount so it doesn't pile up with /auth/me and /notifications/unread-count
        const initial = setTimeout(fetch, 2_000);
        const id = setInterval(fetch, 60_000);
        return () => { clearTimeout(initial); clearInterval(id); };
    }, [fetch]);

    return counts;
}
