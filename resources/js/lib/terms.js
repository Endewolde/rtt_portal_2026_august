import { router } from '@inertiajs/react';
import { setProgrammes } from './programmes';

/**
 * The organisation's own words and currency, set once in Settings → General and
 * used everywhere instead of hard-coded "College", "Department", "Academic year"
 * and "ETB". Defaults keep today's wording.
 */
const DEFAULTS = {
    college: 'College',
    department: 'Department',
    academic_year: 'Academic year',
    currency: 'ETB',
};

let current = { ...DEFAULTS };

const plural = (word) => (/[^aeiou]y$/i.test(word) ? `${word.slice(0, -1)}ies` : /(s|x|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`);

export function setTerms(settings = {}) {
    current = {
        college: settings.term_college || DEFAULTS.college,
        department: settings.term_department || DEFAULTS.department,
        academic_year: settings.term_academic_year || DEFAULTS.academic_year,
        currency: (settings.currency_code || DEFAULTS.currency).toUpperCase(),
    };
}

/** Keep terms in step with the settings each page arrives with. */
export function watchTerms(initialSettings, initialProgrammes) {
    setTerms(initialSettings);
    setProgrammes(initialProgrammes);
    router.on('navigate', (event) => {
        setTerms(event.detail.page.props?.app_settings ?? {});
        setProgrammes(event.detail.page.props?.programmes);
    });
}

/**
 * term('college') → "College"; term('college', { plural: true }) → "Colleges";
 * term('college', { lower: true }) → "college".
 */
export function term(key, { plural: many = false, lower = false } = {}) {
    let word = current[key] ?? DEFAULTS[key] ?? key;
    if (many) word = plural(word);
    return lower ? word.toLowerCase() : word;
}

export const currency = () => current.currency;

/** Swap ETB (and its Amharic ብር) for the configured currency in an already-translated text. */
export function withCurrency(text) {
    const code = currency();
    return code === 'ETB' ? text : String(text).replace(/ETB|ብር/g, code);
}
