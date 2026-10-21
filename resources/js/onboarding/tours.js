/**
 * Role-based onboarding content: guided tours and checklists.
 *
 * A step points at something real on screen:
 *   nav(href, …)          a sidebar menu item
 *   page(route, …)        a page — the tour navigates there first
 *   el(target, …)         an element on the current page or in the header
 *                         ({ desktopOnly } for controls hidden on phones)
 *
 * Steps for pages the user cannot open are dropped at run time: a step that needs
 * a route is only kept when that route is in the user's own sidebar (which already
 * reflects their roles, permissions and switched-on features) or is open to every
 * signed-in user. Tours therefore never show a feature a user isn't allowed to use.
 */

/** Pages every signed-in user can open. */
export const ALWAYS_ROUTES = ['/dashboard', '/profile', '/help', '/notifications', '/calendar'];

const nav = (href, title, description) => ({ kind: 'nav', href, title, description });
const page = (route, title, description, target = null) => ({ kind: 'page', route, title, description, target });
const el = (target, title, description, extra = {}) => ({ kind: 'el', target, title, description, ...extra });

// Targets: a CSS selector, { text } to find a button/link by its label, or a list tried in order.
const PAGE_TITLE = ['[data-tour="page-title"]', 'main h1', 'main h2'];
const button = (text) => [{ text, tags: 'button,a' }, ...PAGE_TITLE];
const TABLE = ['main table', 'main [role="table"]', ...PAGE_TITLE];

// ─── Tours ────────────────────────────────────────────────────────────────────

export const TOURS = {
    basics: {
        title: 'Getting around',
        summary: 'The menu, search, notifications, your profile and where to find help.',
        steps: [
            el('[data-tour="sidebar"]', 'Your menu', 'Everything you can do is in this menu, grouped by stage. It only lists what your role allows — nothing here is off-limits to you.', { mobileTarget: '[data-tour="menu-toggle"]', mobileDescription: 'Tap here to open your menu. Everything you can do is listed there, grouped by stage.' }),
            el('[data-tour="search"]', 'Search anything', 'Jump to any page, proposal or person. Press ⌘K (Ctrl K on Windows) from anywhere.', { desktopOnly: true }),
            el('[data-tour="notifications"]', 'Notifications', 'Decisions, deadlines and requests that need you arrive here. Click one to go straight to it.'),
            el('[data-tour="user-menu"]', 'Your account', 'Open your profile, notification settings, language and two-step sign-in, or sign out.'),
            page('/profile', 'Complete your profile', 'Add your title, department, phone and areas of expertise. Officers use expertise to match reviewers.', PAGE_TITLE),
            el('[data-tour="help-button"]', 'Help is always here', 'Resume or replay any tour, see your getting-started checklist, or open the Help Centre — from any page.'),
            el('[data-tour="assistant"]', 'Ask a question', 'Type a question in plain words — "how do I submit a proposal?" — and get the matching help article or your own live data.'),
        ],
    },

    'researcher.apply': {
        title: 'Applying for funding',
        summary: 'Find an open call, write your proposal in the wizard and submit it.',
        steps: [
            nav('/proposal-calls', 'Proposal calls', 'Open calls for funding, with their deadlines, budgets and eligibility.'),
            page('/proposals/create', 'Start an application', 'Pick an open call to start. The wizard saves as you go, so you can stop and continue later.', button('Start Application')),
            el(PAGE_TITLE, 'The application wizard', 'You\'ll add the title and abstract, your team, the budget and the required documents, then review and submit. "Check my proposal" can give private feedback against the call\'s criteria before you submit.'),
            nav('/my-proposals', 'My Proposals', 'Every proposal you\'re part of, with its current stage. Drafts can be finished from here.'),
            page('/my-proposals', 'Follow your proposals', 'Open a proposal to see its timeline, reviewer feedback when released, and what happens next.', button('New Application')),
            nav('/tracker', 'Track by number', 'Anyone can look up a proposal\'s stage with its tracker number.'),
        ],
    },

    'researcher.funded': {
        title: 'Running a funded project',
        summary: 'Contracts, budget requests, progress reports, outputs and complaints.',
        steps: [
            nav('/my-research', 'Funded proposals', 'Your awarded projects: contract, budget, progress reports and milestones in one place.'),
            page('/my-research', 'Your funded projects', 'Open a project to sign the contract, request money in rounds, upload progress reports every three months and record outputs.', PAGE_TITLE),
            nav('/budget-requests', 'Budget requests', 'Request funds from your approved allocation and follow approval and payment.'),
            nav('/research-outputs', 'Research outputs', 'Record publications, patents and other outputs — they count toward completing your project.'),
            nav('/complaints', 'Complaints', 'If something about a review or your funded project seems wrong, follow your complaints here. You file them from the proposal\'s Complaints tab.'),
        ],
    },

    'reviewer.reviews': {
        title: 'Reviewing proposals',
        summary: 'The confidentiality agreement, your assignments, scoring and due dates.',
        steps: [
            nav('/reviews', 'Assigned reviews', 'Proposals you\'ve been asked to review — blind reviews, open defence panels and conference abstracts.'),
            page('/reviews', 'Your review assignments', 'Each assignment shows its due date. You\'re reminded 7, 3 and 1 days before and on the day.', PAGE_TITLE),
            el(button('Read & accept'), 'Confidentiality agreement', 'Once each academic year, accept the reviewer agreement before opening proposals. If you know the applicants, declare a conflict of interest instead of scoring.'),
            el(button('Score Review'), 'Scoring', 'Open an assignment, read the documents, score every criterion with comments, and submit before the due date. Submitted scores can\'t be changed.'),
        ],
    },

    'college.reviews': {
        title: 'Running reviews for your college',
        summary: 'Assign blind reviewers, schedule open defences and chase late reviews.',
        steps: [
            nav('/admin/blind-review', 'Blind review', 'Validated proposals from your college wait here for reviewers.'),
            page('/admin/blind-review', 'Assign reviewers', 'Use suggested reviewers ranked by expertise, on-time record and workload. Possible conflicts and full workloads are flagged.', button('Assign Reviewers')),
            nav('/admin/open-defence', 'Open defence', 'Proposals that passed blind review — schedule the defence and its panel.'),
            page('/admin/open-defence', 'Schedule a defence', 'Set the date, venue and panel. Scores are due by the end of the next day; the result is calculated automatically.', button('Schedule Defence')),
            nav('/admin/review-deadlines', 'Review deadlines', 'Overdue and due-soon reviews, with reminders and due-date extensions.'),
            nav('/admin/coi-conflicts', 'Conflicts of interest', 'Reviewers who declared a conflict — reassign their reviews here.'),
            nav('/admin/approval-reports', 'Approval reports', 'Report a proposal you believe was approved by mistake, and follow the director\'s decision.'),
        ],
    },

    'college.monitoring': {
        title: 'Following funded projects',
        summary: 'Contracts, budgets, settlements and progress for your college.',
        steps: [
            nav('/admin/contracts', 'Contracts', 'Contracts of funded proposals and their approval status.'),
            nav('/budget-requests', 'Budget requests', 'Review your college\'s budget requests before finance.'),
            nav('/settlements', 'Settlements', 'Verify expense reports at college level before finance\'s final verification.'),
            nav('/progress-reports', 'Progress reports', 'Accept reports or send them back, and chase late ones.'),
            nav('/admin/ethical-clearance', 'Ethical clearance', 'Verify ethics certificates for projects that need them.'),
            nav('/complaints', 'Complaints', 'Level 1 complaints about blind review and open defence in your college.'),
        ],
    },

    'officer.decisions': {
        title: 'Validation and funding decisions',
        summary: 'Validate submissions, decide central evaluation and manage awards.',
        steps: [
            nav('/admin/validation-queue', 'Validation queue', 'New submissions waiting for validation — validate, return for correction, or reject with a reason.'),
            page('/admin/validation-queue', 'Validating proposals', 'Check eligibility and completeness against the call. Validated proposals move on to blind review.', PAGE_TITLE),
            nav('/admin/central-evaluation', 'Central evaluation', 'Proposals that passed open defence, ready for the funding decision.'),
            page('/admin/central-evaluation', 'Deciding funding', 'Each card shows blind, defence and combined scores, the budget, the PI\'s funding history and an AI summary of the reviews.', button('Approve for Funding')),
            el(button('Merit List & Budget'), 'Merit list', 'Proposals ranked by combined score per call, with the line where the call\'s remaining budget runs out.'),
            nav('/admin/funding', 'Proposal funding', 'Funded proposals: adjust award amounts or revoke funding with a reason.'),
            nav('/admin/awarded', 'Awarded proposals', 'Every awarded proposal, filterable and exportable.'),
            nav('/admin/grant-letters', 'Grant letters', 'Generate and print award letters.'),
        ],
    },

    'officer.oversight': {
        title: 'Oversight and exceptions',
        summary: 'Calls, appeals, extensions, approval reports and complaints.',
        steps: [
            nav('/proposal-calls', 'Proposal calls', 'Create and publish calls, set deadlines and the funding budget.'),
            nav('/admin/approval-reports', 'Approval reports', 'Review college officers\' mistaken-approval reports: approval stands, or revoke.'),
            nav('/admin/appeals', 'Appeals', 'Researchers\' reconsideration requests — resolve and explain the decision.'),
            nav('/admin/deadline-extensions', 'Deadline extensions', 'Requests for more time on draft proposals.'),
            nav('/admin/defence-extensions', 'Defence extensions', 'Requests for more time to submit open defence scores.'),
            nav('/complaints', 'Complaints', 'Level 2 complaints after funding, and escalations from colleges.'),
        ],
    },

    'officer.monitoring': {
        title: 'Monitoring projects',
        summary: 'Ongoing projects, progress reports, mid-terms, completion and outputs.',
        steps: [
            nav('/ongoing-proposals', 'Ongoing proposals', 'Every funded project\'s contract, mid-term and completion status.'),
            nav('/progress-reports', 'Progress reports', 'Quarterly reports — accept, send back, or chase late ones.'),
            nav('/midterm-evaluations', 'Mid-term evaluations', 'Schedule mid-terms and record their outcome.'),
            nav('/completion-workshops', 'Completion workshops', 'Run the closing workshop and finalize the project.'),
            nav('/research-outputs', 'Research outputs', 'Verify and approve publications, patents and other outputs.'),
        ],
    },

    'insights.reports': {
        title: 'Reports and insights',
        summary: 'Dashboards, the pipeline, custom reports and delays.',
        steps: [
            nav('/admin/analytics', 'Analytics', 'Submissions, pass rate, the funnel, money and review quality — filtered by year, category and college.'),
            nav('/admin/proposal-pipeline', 'Proposal pipeline', 'Every proposal by stage, with search and export.'),
            page('/admin/proposal-pipeline', 'The pipeline', 'See where proposals are and filter by college, category and year.', PAGE_TITLE),
            nav('/admin/college-phase-completion', 'College phase completion', 'Blind review and open defence progress per college.'),
            nav('/reports/college-dashboard', 'College dashboard', 'Your college\'s proposals by department, category and outcome.'),
            nav('/reports/builder', 'Report builder', 'Choose a subject, filters, groupings and measures — and save the report to run again.'),
            page('/reports/builder', 'Building a report', 'Pick what to report on and how to group it; export to Excel.', PAGE_TITLE),
            nav('/admin/turnaround', 'Turnaround', 'Where proposals wait longest, with a Remind button for whoever must act.'),
        ],
    },

    'finance.money': {
        title: 'Managing project money',
        summary: 'Allocations, requests, disbursements, settlements and milestones.',
        steps: [
            nav('/budget-allocations', 'Budget allocations', 'Allocate and approve each funded project\'s budget.'),
            page('/budget-allocations', 'Allocating budgets', 'A project can only request money once its allocation is approved.', button('Allocate Budget')),
            nav('/budget-requests', 'Budget requests', 'Check signatures and items, then approve or return requests.'),
            nav('/disbursements', 'Disbursements', 'Release approved requests and record the transaction and proof.'),
            page('/disbursements', 'Disbursing funds', 'Totals for this month and overall are at the top.', button('Disburse Funds')),
            nav('/settlements', 'Settlements', 'Final verification of expense reports after the college checks them.'),
            nav('/finance/milestones', 'Budget milestones', 'Milestones tied to each project\'s money.'),
        ],
    },

    'admin.platform': {
        title: 'Running the platform',
        summary: 'Users, settings, the public site, help content and system health.',
        steps: [
            nav('/admin/users', 'Users', 'Create or import users, assign roles, and activate or suspend accounts.'),
            page('/admin/users', 'Managing users', 'Select several users for bulk role changes. "Login as user" lets you see exactly what someone sees.', button('Create New User')),
            nav('/admin/settings', 'Settings', 'Pass marks, eligibility rules, sign-in security, email, uploads, backups and the public site.'),
            nav('/admin/evaluation-criteria', 'Evaluation criteria', 'Scoring forms per category: sections with weights and questions with maximum scores.'),
            nav('/admin/public-site', 'Public site', 'Homepage slides, steps, capability cards and header text.'),
            nav('/admin/help-articles', 'Help articles', 'Edit the help centre and see what people ask the assistant.'),
            nav('/admin/system-monitor', 'System monitor', 'Server health, the queue worker, failed jobs and every email sent.'),
            nav('/admin/audit-logs', 'Audit logs', 'Every change — who, what and when.'),
        ],
    },

    'super.access': {
        title: 'Access control',
        summary: 'Roles, permissions and switching features on or off.',
        steps: [
            nav('/admin/roles', 'Roles', 'The roles users can hold and what each one is for.'),
            nav('/admin/permissions', 'Permissions', 'The individual actions each role is allowed to take.'),
            nav('/admin/features', 'Feature management', 'Switch whole modules or single features on or off for everyone.'),
            page('/admin/features', 'Feature switches', 'Changes apply immediately — switched-off features disappear from every menu.', PAGE_TITLE),
        ],
    },
};

// ─── Roles ────────────────────────────────────────────────────────────────────

const basicsTasks = [
    { id: 'tour.basics', title: 'Take the quick tour', description: 'Learn the menu, search, notifications and help.', tour: 'basics' },
    { id: 'profile', title: 'Complete your profile', description: 'Title, department, phone and expertise.', signal: 'profile_complete', route: '/profile' },
    { id: 'notifications', title: 'Choose your notifications', description: 'Pick email, in-app or a daily digest.', signal: 'notifications_configured', route: '/profile' },
];

const officerChecklist = [
    ...basicsTasks,
    { id: 'tour.decisions', title: 'Learn validation and funding decisions', description: 'Validation queue, central evaluation and awards.', tour: 'officer.decisions' },
    { id: 'validate', title: 'Validate a proposal', description: 'Validate or return one submission.', signal: 'proposal_validated', route: '/admin/validation-queue' },
    { id: 'decide', title: 'Make a funding decision', description: 'Approve or reject in central evaluation.', signal: 'funding_decided', route: '/admin/central-evaluation' },
    { id: 'tour.oversight', title: 'Learn calls, appeals and exceptions', description: 'Calls, approval reports, appeals and extensions.', tour: 'officer.oversight' },
    { id: 'tour.monitoring', title: 'Learn project monitoring', description: 'Progress reports, mid-terms and completion.', tour: 'officer.monitoring' },
    { id: 'report', title: 'Generate a report', description: 'Build or generate any report.', signal: 'report_generated', route: '/reports/builder' },
];

const directorRole = (label, category) => ({
    label,
    welcomeTitle: `Welcome, ${label}`,
    welcomeText: `You oversee ${category} proposals across all colleges — from validation through funding and project monitoring.`,
    highlights: ['Validate new submissions', 'Decide funding in central evaluation', 'Resolve approval reports, appeals and extensions', 'Monitor funded projects and report on them'],
    tours: ['basics', 'officer.decisions', 'officer.oversight', 'officer.monitoring', 'insights.reports'],
    checklist: officerChecklist,
});

export const ROLES = {
    staff: {
        label: 'Researcher',
        welcomeTitle: 'Welcome to the research platform',
        welcomeText: 'Apply for research funding, follow your proposals through review, run funded projects — and review others\' proposals when invited.',
        highlights: ['Apply to open calls with a guided wizard', 'Follow every stage of your proposals', 'Request funds and report progress on funded projects', 'Review proposals you\'re invited to'],
        tours: ['basics', 'researcher.apply', 'researcher.funded', 'reviewer.reviews'],
        checklist: [
            ...basicsTasks,
            { id: 'tour.apply', title: 'Learn how to apply', description: 'Calls, the application wizard and tracking.', tour: 'researcher.apply' },
            { id: 'start', title: 'Start a proposal', description: 'Open a call and begin your application.', signal: 'proposal_started', route: '/proposals/create' },
            { id: 'submit', title: 'Submit a proposal', description: 'Complete the wizard and submit before the deadline.', signal: 'proposal_submitted', route: '/my-proposals' },
            { id: 'tour.reviews', title: 'Learn how reviewing works', description: 'For when you\'re invited to review.', tour: 'reviewer.reviews' },
            { id: 'tour.funded', title: 'Learn how funded projects run', description: 'Contracts, budget requests and progress reports.', tour: 'researcher.funded' },
        ],
    },
    external_reviewer: {
        label: 'External Reviewer',
        welcomeTitle: 'Welcome, reviewer',
        welcomeText: 'Thank you for reviewing. Your assignments, the confidentiality agreement and scoring are all under Assigned Reviews.',
        highlights: ['Accept the confidentiality agreement once a year', 'Score proposals against published criteria', 'Declare any conflict of interest', 'Download your certificate of review service'],
        tours: ['basics', 'reviewer.reviews'],
        checklist: [
            ...basicsTasks,
            { id: 'tour.reviews', title: 'Learn how reviewing works', description: 'Agreement, assignments, scoring and due dates.', tour: 'reviewer.reviews' },
            { id: 'agreement', title: 'Accept the confidentiality agreement', description: 'Required once each academic year.', signal: 'agreement_accepted', route: '/reviews' },
            { id: 'first-review', title: 'Submit your first review', description: 'Score every criterion and add comments.', signal: 'review_submitted', route: '/reviews' },
        ],
    },
    college_officer: {
        label: 'College Officer',
        welcomeTitle: 'Welcome, College Officer',
        welcomeText: 'You run reviews for your college\'s proposals and follow its funded projects — limited to your own college.',
        highlights: ['Assign blind reviewers and schedule open defences', 'Chase late reviews and handle conflicts', 'Verify contracts, budgets and settlements', 'Answer Level 1 complaints'],
        tours: ['basics', 'college.reviews', 'college.monitoring', 'insights.reports'],
        checklist: [
            ...basicsTasks,
            { id: 'tour.reviews', title: 'Learn how to run reviews', description: 'Blind review, open defence and deadlines.', tour: 'college.reviews' },
            { id: 'assign', title: 'Assign reviewers', description: 'Assign blind reviewers to a validated proposal.', signal: 'reviewers_assigned', route: '/admin/blind-review' },
            { id: 'defence', title: 'Schedule an open defence', description: 'Date, venue and panel.', signal: 'defence_scheduled', route: '/admin/open-defence' },
            { id: 'tour.monitoring', title: 'Learn project follow-up', description: 'Contracts, budgets, settlements and reports.', tour: 'college.monitoring' },
            { id: 'progress', title: 'Review a progress report', description: 'Accept one or send it back.', signal: 'progress_report_reviewed', route: '/progress-reports' },
            { id: 'report', title: 'Generate a report', description: 'Report on your college.', signal: 'report_generated', route: '/reports/builder' },
        ],
    },
    college_rtt_manager: {
        label: 'College RTT Manager',
        welcomeTitle: 'Welcome, College RTT Manager',
        welcomeText: 'You make central evaluation and funding decisions for your college\'s proposals in every category, and follow their progress.',
        highlights: ['Decide funding in central evaluation', 'Adjust awards and revoke funding', 'Review progress reports', 'Build reports and follow the pipeline'],
        tours: ['basics', 'officer.decisions', 'insights.reports'],
        checklist: [
            ...basicsTasks,
            { id: 'tour.decisions', title: 'Learn funding decisions', description: 'Central evaluation, merit list and funding.', tour: 'officer.decisions' },
            { id: 'decide', title: 'Make a funding decision', description: 'Approve or reject in central evaluation.', signal: 'funding_decided', route: '/admin/central-evaluation' },
            { id: 'progress', title: 'Review a progress report', description: 'Accept one or send it back.', signal: 'progress_report_reviewed', route: '/progress-reports' },
            { id: 'tour.reports', title: 'Learn reports and the pipeline', description: 'Your college\'s numbers.', tour: 'insights.reports' },
            { id: 'report', title: 'Generate a report', description: 'Report on your college.', signal: 'report_generated', route: '/reports/builder' },
        ],
    },
    research_officer: directorRole('Research Director', 'research'),
    community_officer: directorRole('Community Engagement Director', 'community engagement'),
    technology_officer: directorRole('Technology Transfer Director', 'technology transfer'),
    central_officer: {
        ...directorRole('Central Officer', 'all'),
        welcomeText: 'You coordinate the whole process across every college and category — from validation to funding, monitoring and reporting.',
        tours: ['basics', 'officer.decisions', 'officer.oversight', 'officer.monitoring', 'insights.reports'],
    },
    finance_officer: {
        label: 'Finance Officer',
        welcomeTitle: 'Welcome, Finance Officer',
        welcomeText: 'You manage the money of funded projects: allocations, requests, disbursements and settlements.',
        highlights: ['Allocate and approve budgets', 'Approve budget requests', 'Disburse funds with proof', 'Verify settlements'],
        tours: ['basics', 'finance.money'],
        checklist: [
            ...basicsTasks,
            { id: 'tour.money', title: 'Learn the money workflow', description: 'Allocations to settlements.', tour: 'finance.money' },
            { id: 'disburse', title: 'Disburse funds', description: 'Release one approved request.', signal: 'funds_disbursed', route: '/disbursements' },
        ],
    },
    admin: {
        label: 'Administrator',
        welcomeTitle: 'Welcome, Administrator',
        welcomeText: 'You run the platform — users, settings and content — and can oversee the whole research process.',
        highlights: ['Manage users and roles', 'Configure settings and scoring', 'Maintain the public site and help centre', 'Watch system health and the audit log'],
        tours: ['basics', 'admin.platform', 'officer.decisions', 'insights.reports'],
        checklist: [
            ...basicsTasks,
            { id: 'tour.platform', title: 'Learn platform administration', description: 'Users, settings, content and health.', tour: 'admin.platform' },
            { id: 'tour.decisions', title: 'Learn the decision workflow', description: 'Validation, central evaluation and awards.', tour: 'officer.decisions' },
            { id: 'tour.reports', title: 'Learn reports and insights', description: 'Analytics, pipeline and reports.', tour: 'insights.reports' },
        ],
    },
    super_admin: {
        label: 'Super Admin',
        welcomeTitle: 'Welcome, Super Admin',
        welcomeText: 'You have full access: access control, platform settings and every stage of the research process.',
        highlights: ['Control roles, permissions and features', 'Manage users and settings', 'Oversee every proposal and decision', 'Monitor the system and audit log'],
        tours: ['basics', 'super.access', 'admin.platform', 'officer.decisions', 'officer.monitoring', 'insights.reports'],
        checklist: [
            ...basicsTasks,
            { id: 'tour.access', title: 'Learn access control', description: 'Roles, permissions and features.', tour: 'super.access' },
            { id: 'tour.platform', title: 'Learn platform administration', description: 'Users, settings, content and health.', tour: 'admin.platform' },
            { id: 'tour.decisions', title: 'Learn the decision workflow', description: 'Validation, central evaluation and awards.', tour: 'officer.decisions' },
            { id: 'tour.reports', title: 'Learn reports and insights', description: 'Analytics, pipeline and reports.', tour: 'insights.reports' },
        ],
    },
    general: {
        label: 'Team member',
        welcomeTitle: 'Welcome to the research platform',
        welcomeText: 'Here is a quick look around. Your menu lists everything your role allows.',
        highlights: ['Find your pages in the menu', 'Search anything with ⌘K', 'Follow your notifications', 'Get help any time'],
        tours: ['basics'],
        checklist: basicsTasks,
    },
};
ROLES.pi = ROLES.staff;
ROLES.support_officer = { ...ROLES.general, label: 'Support Officer', tours: ['basics', 'finance.money', 'insights.reports'] };
ROLES.proposal_archivist = { ...ROLES.general, label: 'Proposal Archivist' };

export const roleConfig = (role) => ROLES[role] ?? ROLES.general;

/** Is a checklist task done — ticked by hand, detected from real activity, or its tour finished? */
export function isTaskDone(task, progress) {
    if (!progress) return false;
    return (progress.completed_tasks ?? []).includes(task.id)
        || (task.signal && progress.signals?.[task.signal])
        || (task.tour && (progress.completed_tours ?? []).includes(task.tour));
}
