import { useState, useEffect, useCallback } from 'react';

export function useProposal(proposalCallId) {
    const storageKey = `rtt_wizard_${proposalCallId}`;

    const [data, setData] = useState(() => {
        try { return JSON.parse(localStorage.getItem(storageKey)) ?? {}; } catch { return {}; }
    });

    const saveStep = useCallback((step, stepData) => {
        setData((prev) => {
            const next = { ...prev, [`step_${step}`]: stepData };
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        });
    }, [storageKey]);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(storageKey);
        setData({});
    }, [storageKey]);

    const getStep = useCallback((step) => data[`step_${step}`] ?? {}, [data]);

    return { data, saveStep, getStep, clearDraft };
}
