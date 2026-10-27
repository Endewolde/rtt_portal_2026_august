/**
 * The public homepage's defaults — the menu, the hero slides and the "How it works"
 * steps — shared by the public pages and the Public Site editor, so what the editor
 * shows as "default" is exactly what visitors see when nothing is changed.
 */

/** The public header's menu. Settings refer to items by position (public_nav_item_{n}_*). */
export const NAV_DEFAULTS = [
    { href: '/',                       label: 'Home' },
    { href: '/proposal-calls/public',  label: 'Open Calls' },
    { href: '/conferences',            label: 'Conferences' },
    { href: '/explore',                label: 'Explore' },
    { href: '/funding-opportunities',  label: 'Funding Opportunities' },
    { href: '/repository',             label: 'Repository' },
    { href: '/tracker',                label: 'Track Proposal' },
    // New items go last: settings refer to items by position.
    { href: '/researchers',            label: 'Researchers' },
];

export const STEP_DEFAULTS = [
    { title: 'Submit Proposal',      desc: 'Complete the guided wizard with your research details, team, budget, and documents before the call closes.' },
    { title: 'Validation',           desc: 'The research office checks completeness and eligibility, and an anonymity check protects blind review.' },
    { title: 'Blind Review',         desc: 'Independent experts score your proposal without knowing who wrote it.' },
    { title: 'Open Defence',         desc: 'Shortlisted teams present to a panel that scores the presentation on the day.' },
    { title: 'Central Evaluation',   desc: 'The central committee weighs the combined scores and makes the funding decision.' },
    { title: 'Funding & Monitoring', desc: 'Funded teams sign a contract, receive their budget, and report progress regularly until completion.' },
];

/** Up to six hero slides; the first one's eyebrow defaults to the organisation's name. */
export const SLIDE_DEFAULTS = [
    { eyebrow: 'Research Platform',  heading: 'Accelerate Your', highlight: 'Research Journey',      color: '',        icon: '🔬', subtitle: 'Submit proposals, collaborate with peers, and manage grants — all in one platform built for academic excellence.' },
    { eyebrow: 'Research Funding',   heading: 'Unlock Research', highlight: 'Funding Opportunities', color: '#10b981', icon: '💰', subtitle: 'Competitive grants, milestone-based disbursements, and award letters to fuel your research ambitions.' },
    { eyebrow: 'Peer Evaluation',    heading: 'Rigorous & Fair', highlight: 'Peer Review Process',   color: '#f59e0b', icon: '⚖️', subtitle: 'Expert blind review, open defence scoring, and central committee evaluation — transparent and objective.' },
    { eyebrow: 'Research Lifecycle', heading: 'End-to-End',      highlight: 'Research Support',      color: '#8b5cf6', icon: '🏛️', subtitle: 'From ethics clearance to midterm evaluation and project closure — comprehensive institutional support.' },
    { eyebrow: 'Research Impact',    heading: 'Measure Your',    highlight: 'Research Impact',       color: '#ef4444', icon: '📊', subtitle: 'Track outcomes, measure impact, and showcase your research achievements across the institution.' },
    { eyebrow: 'Global Reach',       heading: 'Expand Your',     highlight: 'Research Network',      color: '#06b6d4', icon: '🌐', subtitle: 'Connect with international partners, co-investigators, and funding bodies worldwide.' },
];

export const COLOR_DEFAULTS = {
    public_topbar_bg: '#0f172a',
    public_topbar_text: '#94a3b8',
    public_hero_bg: '#0f172a',
    public_cards_bg: '#f9fafb',
    public_features_bg: '#0f172a',
    public_footer_bg: '#0f172a',
};
