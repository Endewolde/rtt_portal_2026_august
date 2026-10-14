import {
    FileText, EyeOff, Presentation, Scale, Award, ClipboardCheck, BadgeCheck, ShieldCheck,
    BookOpen, BarChart3, Users, Globe2, Lightbulb, Microscope, Rocket, Handshake,
    GraduationCap, Wallet, Calendar, Layers,
} from 'lucide-react';

/** Icons an admin can choose for a capability card on the public homepage. */
export const FEATURE_ICONS = {
    FileText, EyeOff, Presentation, Scale, Award, ClipboardCheck, BadgeCheck, ShieldCheck,
    BookOpen, BarChart3, Users, Globe2, Lightbulb, Microscope, Rocket, Handshake,
    GraduationCap, Wallet, Calendar, Layers,
};

/**
 * The homepage "Platform Capabilities" cards. Each is editable in Admin → Public Site →
 * Capabilities through `public_feature_{n}_title|desc|icon|show`; these are the defaults.
 */
export const FEATURE_DEFAULTS = [
    { icon: 'FileText',       title: 'Guided Submission',       desc: 'A step-by-step proposal wizard, team invitations, and a live status guide that tells researchers what happens next.' },
    { icon: 'EyeOff',         title: 'Truly Blind Review',      desc: 'Automatic anonymity checks on every submission, and alerts when independent reviewers disagree sharply.' },
    { icon: 'Presentation',   title: 'Open Defence Scoring',    desc: 'Scheduled defence panels, on-the-day scoring, and firm score deadlines with a formal extension process.' },
    { icon: 'Scale',          title: 'Transparent Decisions',   desc: 'Blind review and defence scores combined against published thresholds before the central funding decision.' },
    { icon: 'Award',          title: 'Grants & Contracts',      desc: 'Award letters with grant references, research contracts, budget allocation, and staged disbursement.' },
    { icon: 'ClipboardCheck', title: 'Progress Monitoring',     desc: 'Regular progress reports, milestones, mid-term evaluation, and completion workshops for every funded project.' },
    { icon: 'BadgeCheck',     title: 'Verifiable Certificates', desc: 'Reviewers earn QR-coded certificates of service that anyone can verify online.' },
    { icon: 'ShieldCheck',    title: 'Accountability & Audit',  desc: 'Full audit trails, similarity detection, and stage turnaround tracking that keeps decisions on time.' },
];

/** The cards to show, with an admin's saved text, icon and visibility over the defaults. */
export function resolveFeatures(settings = {}) {
    return FEATURE_DEFAULTS.map((d, i) => {
        const key = (field) => settings[`public_feature_${i + 1}_${field}`];
        return {
            title: key('title') || d.title,
            desc: key('desc') || d.desc,
            icon: FEATURE_ICONS[key('icon')] ?? FEATURE_ICONS[d.icon],
            visible: key('show') !== 'false',
        };
    }).filter((f) => f.visible);
}
