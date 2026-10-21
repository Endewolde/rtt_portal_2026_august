// ─── Route access map ─────────────────────────────────────────────────────────

// Every page is opened by permission, never by role name, so a custom role works
// for exactly what is ticked on the Roles page. A value can be one permission or a
// list (any of them). Longer paths must come first: matching is by prefix.
// Any /admin/* path not listed here is denied (see routeAllowed below).
export const ROUTE_ACCESS = [
    // Access control & platform
    ['/admin/roles',               'roles.manage'],
    ['/admin/permissions',         'roles.manage'],
    ['/admin/features',            'features.manage'],
    ['/admin/thematic-areas',      'thematic_areas.manage'],
    ['/admin/dropdown-options',    'lookup_options.update'],
    ['/admin/settings',            'settings.manage'],
    ['/admin/public-site',         'settings.manage'],
    ['/admin/system-monitor',      'system_monitor.view_any'],
    ['/admin/audit-logs',          'audit_logs.view_any'],
    ['/admin/users',               'users.view_any'],
    ['/admin/colleges',            'colleges.view_any'],
    ['/admin/departments',         'departments.view_any'],
    ['/admin/resources',           'content.manage'],
    ['/admin/login-notices',       'content.manage'],
    ['/admin/faqs',                'content.manage'],
    ['/admin/feedback',            'content.manage'],
    ['/admin/help-articles',       'help.manage'],
    ['/admin/data-requests',       'data_requests.manage'],
    // Proposals & decisions
    ['/admin/proposal-archive',    'proposal_archive.view'],
    ['/admin/validation-queue',    'proposals.validate'],
    ['/admin/central-evaluation',  'evaluation.central'],
    ['/admin/funding',             'funding.manage'],
    ['/admin/awarded',             'awards.list'],
    ['/admin/completed-archive',   'awards.list'],
    ['/admin/grant-letters',       'awards.letters'],
    ['/admin/contracts',           'contracts.view'],
    ['/admin/approval-reports',    ['approval_reports.resolve', 'approval_reports.file']],
    ['/admin/appeals',             'appeals.resolve'],
    ['/admin/deadline-extensions', 'deadline_extensions.resolve'],
    ['/admin/similarity-flags',    'similarity.view'],
    // Review & evaluation
    ['/admin/evaluation-criteria', 'evaluation_criteria.manage'],
    ['/admin/assign-reviewers',    'proposals.assign_reviewer'],
    ['/admin/review-assignment',   'proposals.assign_reviewer'],
    ['/admin/blind-review',        'reviews.manage'],
    ['/admin/open-defence',        'reviews.manage'],
    ['/admin/review-deadlines',    'review_deadlines.manage'],
    ['/admin/coi-conflicts',       'conflicts.manage'],
    ['/admin/defence-extensions',  'defence_extensions.approve'],
    ['/admin/reviewer-workload',   'reviewer_workload.view'],
    ['/admin/review-certificates', 'review_certificates.manage'],
    // Monitoring & finance
    ['/admin/ethical-clearance',   'ethical_clearance.review'],
    ['/admin/no-cost-extensions',  'no_cost_extensions.review'],
    ['/admin/budget-revisions',    'budget_revisions.review'],
    ['/admin/repository',          'repository.manage'],
    ['/ongoing-proposals',         'monitoring.ongoing'],
    ['/progress-reports',          'progress_reports.review'],
    ['/budget-allocations',        'budget_allocations.view_any'],
    ['/budget-requests',           'budget_requests.view_any'],
    ['/finance/milestones',        'budget_requests.view_any'],
    ['/disbursements',             'disbursements.view_any'],
    ['/settlements',               'settlements.view_any'],
    ['/midterm-evaluations',       'midterm_evaluations.view_any'],
    ['/completion-workshops',      'completion_workshops.view_any'],
    ['/research-outputs',          'research_outputs.view_any'],
    ['/research-impact',           'research_outputs.view_any'],
    ['/admin/external-funds',      'external_funds.view_any'],
    // Reports
    ['/admin/analytics',           'analytics.view'],
    ['/admin/turnaround',          'turnaround.view'],
    ['/admin/proposal-pipeline',   'pipeline.view'],
    ['/admin/college-phase-completion', 'phase_completion.view'],
    ['/reports/college-dashboard', 'reports.view_any'],
    ['/reports/annual',            'annual_report.view'],
    ['/reports/builder',           'reports.create'],
    ['/reports',                   'reports.view_any'],
    // Events
    ['/admin/conferences',         'conferences.manage'],
    ['/admin/abstracts',           'conferences.manage'],
    // Researcher & reviewer pages
    ['/proposals/create',          'proposals.create'],
    ['/my-proposals',              'proposals.submit'],
    ['/my-research',               'proposals.submit'],
    ['/proposals',                 'proposals.view_any'],
    ['/reviews',                   'review_assignments.view_any'],
    ['/complaints',                'complaints.view'],
]

/** The permission (or any of the permissions) a page needs, or null if it needs none. */
export function getRequiredAccess(path) {
    const bare = (path || '').split('?')[0]
    const match = ROUTE_ACCESS.find(([prefix]) => bare === prefix || bare.startsWith(prefix + '/'))
    return match ? match[1] : null
}

/**
 * Can someone with these permissions open a page? Paths under /admin/ with no
 * entry are denied; any other unlisted path is open to every signed-in user.
 *
 * @param {string} path
 * @param {(permission: string) => boolean} hasPermission
 */
export function canOpenPath(path, hasPermission) {
    const required = getRequiredAccess(path)
    if (required === null) return !(path || '').startsWith('/admin/')
    return Array.isArray(required) ? required.some(p => hasPermission(p)) : hasPermission(required)
}
