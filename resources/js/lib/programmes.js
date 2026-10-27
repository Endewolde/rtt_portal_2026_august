/**
 * The organisation's funding programmes (proposal "categories"), shared with every
 * page by the server and kept in step on each visit. Use these instead of
 * hard-coding research / community engagement / technology transfer.
 */
const FALLBACK = [
    { key: 'research', name: 'Research', color: '#3b82f6', is_active: true },
    { key: 'community_engagement', name: 'Community Engagement', color: '#10b981', is_active: true },
    { key: 'technology_transfer', name: 'Technology Transfer', color: '#8b5cf6', is_active: true },
];

let list = FALLBACK;

export function setProgrammes(programmes) {
    if (Array.isArray(programmes) && programmes.length) list = programmes;
}

/** Programmes in display order; active ones only unless asked. */
export const programmes = ({ includeInactive = false } = {}) => (includeInactive ? list : list.filter((p) => p.is_active));

/** Keys of the active programmes, e.g. for a filter's options. */
export const programmeKeys = (opts) => programmes(opts).map((p) => p.key);

export const programmeByKey = (key) => list.find((p) => p.key === key) ?? null;

export const programmeLabel = (key) => programmeByKey(key)?.name ?? (key ? String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');

export const programmeColor = (key) => programmeByKey(key)?.color ?? '#64748b';

const BUILT_IN = ['research', 'community_engagement', 'technology_transfer'];

/**
 * Turn a page's styled category list (icons, colours) into the live programme list.
 * Each programme keeps the page's styling for its key when there is one; new
 * programmes borrow the "other" style with their own colour. An "all" entry
 * (empty key) stays first and legacy extras such as "innovation" stay last.
 */
export function styledProgrammes(styled, idKey = 'value') {
    const byKey = Object.fromEntries(styled.map((s) => [s[idKey], s]));
    const fallback = byKey.other ?? byKey.innovation ?? styled[styled.length - 1] ?? {};
    const keys = programmeKeys();
    const live = programmes().map((p) => {
        const base = byKey[p.key] ?? { ...fallback, ...(String(fallback.color ?? '').startsWith('#') ? { color: p.color, bg: `${p.color}14` } : {}) };
        return { ...base, [idKey]: p.key, label: p.name };
    });
    const head = styled.filter((s) => s[idKey] === '');
    const extras = styled.filter((s) => s[idKey] !== '' && !BUILT_IN.includes(s[idKey]) && !keys.includes(s[idKey]));
    return [...head, ...live, ...extras];
}
