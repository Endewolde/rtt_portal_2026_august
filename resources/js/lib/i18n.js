import { useCallback, useEffect, useState } from 'react';
import am from './translations/am';

/**
 * Lightweight interface translation. Text is written in English and looked up by its
 * English wording; anything without a translation simply stays in English, so screens can
 * be translated one at a time. The choice is remembered on the device.
 */
const STORAGE_KEY = 'rtt_lang';
const DICTIONARIES = { am };
export const LANGUAGES = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'am', label: 'አማርኛ', short: 'አማ' },
];

const read = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return LANGUAGES.some((l) => l.code === saved) ? saved : 'en';
    } catch {
        return 'en';
    }
};

let current = typeof window === 'undefined' ? 'en' : read();
const listeners = new Set();

export function getLanguage() {
    return current;
}

export function setLanguage(code) {
    current = LANGUAGES.some((l) => l.code === code) ? code : 'en';
    try { localStorage.setItem(STORAGE_KEY, current); } catch { /* private mode */ }
    if (typeof document !== 'undefined') document.documentElement.lang = current;
    listeners.forEach((fn) => fn(current));
}

export function useLanguage() {
    const [lang, setLang] = useState(current);
    useEffect(() => {
        listeners.add(setLang);
        return () => listeners.delete(setLang);
    }, []);
    return [lang, setLanguage];
}

/** `t('Open Calls')`, or with placeholders: `t(':count more', { count: 3 })`. */
export function translate(text, vars = {}, lang = current) {
    if (typeof text !== 'string') return text;
    const found = DICTIONARIES[lang]?.[text] ?? text;
    return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`:${k}`, String(v)), found);
}

export function useT() {
    const [lang] = useLanguage();
    return useCallback((text, vars) => translate(text, vars, lang), [lang]);
}

if (typeof document !== 'undefined') document.documentElement.lang = current;
