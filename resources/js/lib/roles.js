/**
 * Role names → the labels people see. Built-in roles start with the labels from
 * config/access.php; the server's current labels (renamed or custom roles) replace
 * them as soon as they are known, so every page shows the same, latest names.
 */
const labels = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    central_officer: 'Central Officer',
    research_officer: 'Research Director',
    community_officer: 'Community Engagement Director',
    technology_officer: 'Technology Transfer Director',
    college_rtt_manager: 'College RTT Manager',
    college_officer: 'College Officer',
    finance_officer: 'Finance Officer',
    support_officer: 'Support Officer',
    staff: 'Researcher (Staff)',
    pi: 'Principal Investigator',
    reviewer: 'Reviewer',
    external_reviewer: 'External Reviewer',
    proposal_archivist: 'Proposal Archivist',
    guest: 'Guest',
};

const headline = (name) => String(name ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** A role's name, whether given as a string or as a role object. */
export const roleName = (role) => (typeof role === 'string' ? role : role?.name);

/** The label for a role (string name or role object). */
export function roleLabel(role) {
    const name = roleName(role);
    if (!name) return '';
    if (typeof role === 'object' && role?.label) labels[name] = role.label;
    return labels[name] ?? headline(name);
}

/**
 * Remember the server's labels: an array of role objects ({ name, label }) or a
 * { name: label } map.
 */
export function rememberRoleLabels(source) {
    if (!source) return;
    const entries = Array.isArray(source) ? source.map((r) => [r?.name, r?.label]) : Object.entries(source);
    entries.forEach(([name, label]) => { if (name && label) labels[name] = label; });
}
