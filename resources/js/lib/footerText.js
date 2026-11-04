/**
 * Placeholders the footer text may use, filled in when it is shown — so
 * "© {year} {system}. All rights reserved." keeps the year current by itself.
 */
export const FOOTER_TOKENS = [
    { token: '{year}', label: 'Current year' },
    { token: '{org}', label: 'Organisation name' },
    { token: '{system}', label: 'System name' },
]

/** The footer text with its placeholders replaced, using the shared app settings. */
export function resolveFooterText(text, settings = {}, now = new Date()) {
    return String(text ?? '')
        .replace(/\{year\}/gi, String(now.getFullYear()))
        .replace(/\{org\}/gi, settings.organization_name || 'University')
        .replace(/\{system\}/gi, settings.system_name || 'RTT Platform')
}

/** True when the text spells out this year — offered as a one-click switch to {year}. */
export function hasFixedCurrentYear(text, now = new Date()) {
    return new RegExp(`\\b${now.getFullYear()}\\b`).test(String(text ?? ''))
}
