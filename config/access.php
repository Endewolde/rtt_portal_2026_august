<?php

/*
|--------------------------------------------------------------------------
| Access control: roles, data scopes and the permission catalogue
|--------------------------------------------------------------------------
|
| A role grants permissions (what someone may do) and has a data scope (which
| records it applies to). Every access decision in the platform checks a
| permission from this catalogue, so a custom role works for exactly the
| permissions ticked on the Roles page.
|
| 'roles' on a permission lists the built-in roles that hold it by default —
| granted when the permission is first created, and by the role seeder on a
| fresh install. Edits made on the Roles page are never overwritten.
|
*/

$A = ['super_admin', 'admin', 'central_officer'];              // administration
$D = ['research_officer', 'community_officer', 'technology_officer']; // category directors
$CO = 'college_officer';
$M = 'college_rtt_manager';

return [

    /*
    | Data scopes a role can have.
    */
    'scopes' => [
        'all' => ['label' => 'All colleges and categories', 'description' => 'Every record in the platform.'],
        'college' => ['label' => 'Own college', 'description' => 'Records of the user\'s college, in every category. The user must belong to a college.'],
        'college_if_set' => ['label' => 'Own college, or all if none', 'description' => 'The user\'s college when they have one; otherwise every record.'],
        'category' => ['label' => 'One category', 'description' => 'Records in one proposal category, across all colleges.'],
        'own' => ['label' => 'Own records only', 'description' => 'Only proposals and projects the user is part of.'],
    ],

    'categories' => [
        'research' => 'Research',
        'community_engagement' => 'Community Engagement',
        'technology_transfer' => 'Technology Transfer',
    ],

    /*
    | Built-in roles: protected from rename and delete.
    */
    'roles' => [
        'super_admin' => ['label' => 'Super Admin', 'scope' => 'all', 'description' => 'Full access, including access control and system settings.'],
        'admin' => ['label' => 'Administrator', 'scope' => 'all', 'description' => 'Runs the platform: users, settings, content and oversight of all proposals.'],
        'central_officer' => ['label' => 'Central Officer', 'scope' => 'all', 'description' => 'Coordinates the whole process across every college and category.'],
        'research_officer' => ['label' => 'Research Director', 'scope' => 'category', 'category' => 'research', 'description' => 'Oversees research proposals across all colleges.'],
        'community_officer' => ['label' => 'Community Engagement Director', 'scope' => 'category', 'category' => 'community_engagement', 'description' => 'Oversees community engagement proposals across all colleges.'],
        'technology_officer' => ['label' => 'Technology Transfer Director', 'scope' => 'category', 'category' => 'technology_transfer', 'description' => 'Oversees technology transfer proposals across all colleges.'],
        'college_rtt_manager' => ['label' => 'College RTT Manager', 'scope' => 'college', 'description' => 'Central evaluation, funding, progress reports and reporting for one college, every category.'],
        'college_officer' => ['label' => 'College Officer', 'scope' => 'college', 'description' => 'Runs reviews and follows funded projects for one college.'],
        'finance_officer' => ['label' => 'Finance Officer', 'scope' => 'college', 'description' => 'Budgets, disbursements and settlements for one college.'],
        'support_officer' => ['label' => 'Support Officer', 'scope' => 'college_if_set', 'description' => 'Finance support: disbursements, settlements and milestones.'],
        'staff' => ['label' => 'Researcher (Staff)', 'scope' => 'own', 'description' => 'Applies for funding, runs funded projects and reviews when invited.'],
        'pi' => ['label' => 'Principal Investigator', 'scope' => 'own', 'description' => 'Legacy researcher role.'],
        'reviewer' => ['label' => 'Reviewer', 'scope' => 'own', 'description' => 'Legacy reviewer role.'],
        'external_reviewer' => ['label' => 'External Reviewer', 'scope' => 'own', 'description' => 'Reviews proposals they are invited to.'],
        'proposal_archivist' => ['label' => 'Proposal Archivist', 'scope' => 'all', 'description' => 'Read-only access to the full proposal archive.'],
        'guest' => ['label' => 'Guest', 'scope' => 'own', 'description' => 'Limited, time-bound access.'],
    ],

    /*
    | The permission catalogue, grouped as on the Roles page.
    */
    'groups' => [

        'Proposals' => [
            'proposals.view_any' => ['label' => 'See the proposals list', 'description' => 'Open All Proposals (within the role\'s scope).'],
            'proposals.view' => ['label' => 'Open a proposal', 'description' => 'View a proposal\'s details.'],
            'proposals.create' => ['label' => 'Start a proposal', 'description' => 'Create a new application.'],
            'proposals.update' => ['label' => 'Edit proposals', 'description' => 'Change proposals within scope.'],
            'proposals.submit' => ['label' => 'Submit proposals', 'description' => 'Submit an application to a call.'],
            'proposals.track' => ['label' => 'Track by tracker number', 'description' => 'Look up a proposal\'s stage.'],
            'proposals.export' => ['label' => 'Export proposals', 'description' => 'Download proposal lists.'],
            'proposals.validate' => ['label' => 'Validate submissions', 'description' => 'Validate, return for correction or reject new submissions.'],
            'proposals.reopen' => ['label' => 'Reopen rejected proposals', 'description' => 'Reopen a rejected proposal for reconsideration.', 'roles' => ['super_admin', 'central_officer', ...$D]],
            'proposal_calls.view_any' => ['label' => 'See proposal calls', 'description' => 'Open the list of calls.'],
            'proposal_calls.create' => ['label' => 'Create calls', 'description' => 'Create and publish proposal calls.'],
            'proposal_calls.update' => ['label' => 'Edit calls', 'description' => 'Change calls, deadlines and budgets.'],
            'proposal_calls.delete' => ['label' => 'Delete calls', 'description' => 'Delete proposal calls.'],
            'proposal_calls.view_drafts' => ['label' => 'See draft and closed calls', 'description' => 'Proposal Calls lists every call with submission counts, not just open ones.', 'roles' => ['super_admin', 'central_officer', $CO]],
            'proposal_calls.view_submissions' => ['label' => 'See a call\'s submissions', 'description' => 'Open the submissions list of a call.', 'roles' => [...$A, ...$D, $CO]],
            'proposal_archive.view' => ['label' => 'Search the proposal archive', 'description' => 'Search every proposal with its documents and team.', 'roles' => ['super_admin', 'proposal_archivist']],
            'similarity.view' => ['label' => 'Similarity flags', 'description' => 'See proposals flagged as very similar to others.', 'roles' => $A],
            'proposals.view_identity' => ['label' => 'See author identities', 'description' => 'See the PI, team and submission history of proposals they are not part of. Leave off for roles that run or do blind review.', 'roles' => [...$A, ...$D, $M, 'finance_officer', 'support_officer', 'proposal_archivist']],
            'proposals.view_documents' => ['label' => 'See all proposal documents', 'description' => 'Without it, only the proposal document and budget are shown (as for reviewers).', 'roles' => [...$A, ...$D, $CO, $M, 'finance_officer', 'support_officer', 'proposal_archivist']],
            'proposals.view_cv' => ['label' => 'See PI CVs', 'description' => 'Open the CV a PI uploaded.', 'roles' => [...$A, $M, 'proposal_archivist']],
            'proposals.clone' => ['label' => 'Copy anyone\'s proposal', 'description' => 'Clone any proposal as a new draft (PIs can always copy their own).', 'roles' => $A],
        ],

        'Review & evaluation' => [
            'reviews.view_any' => ['label' => 'See reviews', 'description' => 'View review records.'],
            'review_assignments.view_any' => ['label' => 'Review proposals (Assigned Reviews)', 'description' => 'See and score the reviews assigned to them.'],
            'proposals.assign_reviewer' => ['label' => 'Assign reviewers', 'description' => 'Assign blind reviewers and panel members.'],
            'reviews.manage' => ['label' => 'Run blind review and open defence', 'description' => 'Blind Review and Open Defence pages: assign, replace and remove reviewers, schedule defences.', 'roles' => [...$A, $CO]],
            'open_defence.manage' => ['label' => 'Update open defences', 'description' => 'Change a scheduled defence: date, venue and panel.', 'roles' => [...$A, ...$D, $CO]],
            'open_defence.attendance' => ['label' => 'Record defence attendance', 'description' => 'Mark an open defence as held, or record that the team did not appear — which rejects the proposal and voids any scores.', 'roles' => [$CO]],
            'review_results.view' => ['label' => 'See review results and scores', 'description' => 'Scores, comments and recalculation on a proposal.', 'roles' => [...$A, ...$D, $CO]],
            'reviewer_match.view' => ['label' => 'Suggested reviewers', 'description' => 'See reviewer suggestions matched to a proposal.'],
            'proposal_ai_scores.view' => ['label' => 'See AI pre-screening scores', 'description' => 'AI quality scores on a proposal.'],
            'proposal_ai_scores.generate' => ['label' => 'Run AI pre-screening', 'description' => 'Generate an AI quality score for a proposal.'],
            'review_decisions.correct' => ['label' => 'Correct review decisions', 'description' => 'Apply recalculated blind or defence decisions.', 'roles' => [...$A, ...$D]],
            'review_deadlines.manage' => ['label' => 'Manage review deadlines', 'description' => 'Remind reviewers and extend due dates.', 'roles' => [...$A, $CO]],
            'reviewer_workload.view' => ['label' => 'See reviewer workload', 'description' => 'Reviewer Workload, analytics and the payment report.', 'roles' => [...$A, ...$D, $CO]],
            'conflicts.manage' => ['label' => 'Handle conflicts of interest', 'description' => 'Reassign reviews where a reviewer declared a conflict.', 'roles' => [...$A, ...$D, $CO]],
            'defence_extensions.request' => ['label' => 'Request defence score extensions', 'description' => 'Ask for more time for panel scores.', 'roles' => [$CO]],
            'defence_extensions.approve' => ['label' => 'Approve defence score extensions', 'description' => 'Approve or decline those requests.', 'roles' => [...$A, ...$D]],
            'review_certificates.manage' => ['label' => 'Manage reviewer certificates', 'description' => 'Release, revoke and reinstate certificates.', 'roles' => $A],
            'evaluation_criteria.manage' => ['label' => 'Edit evaluation criteria', 'description' => 'Scoring forms, weights and questions.'],
        ],

        'Decisions & funding' => [
            'evaluation.central' => ['label' => 'Decide funding (central evaluation)', 'description' => 'Approve or reject proposals that passed open defence; merit list.', 'roles' => ['super_admin', 'central_officer', ...$D, $M]],
            'funding.manage' => ['label' => 'Manage funded proposals', 'description' => 'Proposal Funding: adjust award amounts.', 'roles' => [...$A, ...$D, $M]],
            'funding.revoke' => ['label' => 'Revoke funding', 'description' => 'Revoke a funded proposal\'s funding with a reason.', 'roles' => ['super_admin', 'central_officer', $M]],
            'awards.view_any' => ['label' => 'See awards', 'description' => 'Awarded proposals and award details.'],
            'awards.view' => ['label' => 'See central evaluation results', 'description' => 'Merit list and evaluation results.'],
            'awards.create' => ['label' => 'Create awards', 'description' => 'Generate an award for an accepted proposal.'],
            'awards.update' => ['label' => 'Edit awards', 'description' => 'Change award amounts and notes.'],
            'awards.letters' => ['label' => 'Award letters', 'description' => 'Generate grant letters.', 'roles' => [...$A, ...$D, $CO, 'support_officer']],
            'awards.export' => ['label' => 'Export awarded proposals', 'description' => 'Download the awarded proposals list (within scope).', 'roles' => [...$A, ...$D, $CO, $M, 'support_officer']],
            'awards.list' => ['label' => 'Awarded and completed projects', 'description' => 'Open Awarded Proposals and the Completed Archive (within scope).', 'roles' => [...$A, ...$D, $CO, 'finance_officer', $M]],
            'contracts.review' => ['label' => 'Review contracts', 'description' => 'Approve or reject project contracts.', 'roles' => [...$A, ...$D, $CO, 'support_officer']],
            'contracts.view' => ['label' => 'See contracts', 'description' => 'Open the Contracts page (within scope).', 'roles' => [...$A, ...$D, $CO, 'finance_officer', 'support_officer']],
            'contracts.download' => ['label' => 'Download contracts', 'description' => 'Download signed contracts.'],
            'ai.review_summary' => ['label' => 'AI review summary', 'description' => 'Generate and read AI summaries of reviews.', 'roles' => [...$A, ...$D, $M]],
            'approval_reports.file' => ['label' => 'Report a mistaken approval', 'description' => 'Flag a proposal as possibly approved by mistake.', 'roles' => [$CO]],
            'approval_reports.resolve' => ['label' => 'Resolve approval reports', 'description' => 'Decide whether a reported approval stands.', 'roles' => [...$A, ...$D]],
            'appeals.resolve' => ['label' => 'Resolve appeals', 'description' => 'Decide reconsideration requests.', 'roles' => ['super_admin', 'central_officer', ...$D]],
            'deadline_extensions.resolve' => ['label' => 'Resolve draft deadline extensions', 'description' => 'Give researchers more time to finish a draft.', 'roles' => [...$A, ...$D]],
            'complaints.view' => ['label' => 'Open the Complaints page', 'description' => 'See the Complaints page (their own complaints, or those they handle).'],
            'complaints.view_any' => ['label' => 'See complaints', 'description' => 'Complaints within the role\'s scope.'],
            'complaints.create' => ['label' => 'File complaints', 'description' => 'File a complaint about their own proposal.'],
            'complaints.moderate' => ['label' => 'Edit or withdraw anyone\'s complaint', 'description' => 'Change or withdraw complaints filed by others.', 'roles' => ['super_admin', 'central_officer']],
            'complaints.respond' => ['label' => 'Respond to complaints', 'description' => 'Answer complaints within scope (Level 1 for colleges, Level 2 for categories).', 'roles' => [...$A, ...$D, $CO]],
        ],

        'Monitoring' => [
            'monitoring.ongoing' => ['label' => 'Ongoing proposals', 'description' => 'Monitor every funded project.', 'roles' => [...$A, ...$D, $CO]],
            'monitoring.archive' => ['label' => 'Archive completed projects', 'description' => 'Move completed projects to the archive.', 'roles' => ['super_admin', 'central_officer']],
            'monitoring.legacy_grants' => ['label' => 'Grant legacy projects', 'description' => 'Add older grants that predate the platform.', 'roles' => $A],
            'progress_reports.review' => ['label' => 'Review progress reports', 'description' => 'Accept or return quarterly reports.', 'roles' => [...$A, ...$D, $CO, $M]],
            'midterm_evaluations.view_any' => ['label' => 'See mid-term evaluations', 'description' => 'Open Mid-term Evaluations.'],
            'midterm_evaluations.create' => ['label' => 'Schedule mid-term evaluations', 'description' => 'Schedule and record mid-terms.'],
            'completion_workshops.view_any' => ['label' => 'See completion workshops', 'description' => 'Open Completion Workshops.'],
            'completion_workshops.create' => ['label' => 'Run completion workshops', 'description' => 'Schedule and finalize workshops.'],
            'completion_workshops.discuss' => ['label' => 'Answer workshop questions', 'description' => 'Answer questions raised in completion workshops.', 'roles' => [...$A, ...$D, $CO, 'support_officer']],
            'completion_workshops.moderate' => ['label' => 'Moderate workshop questions', 'description' => 'Delete anyone\'s workshop questions.', 'roles' => $A],
            'research_outputs.view_any' => ['label' => 'See research outputs', 'description' => 'Open Research Outputs.'],
            'research_outputs.create' => ['label' => 'Record research outputs', 'description' => 'Add outputs to projects.'],
            'research_outputs.update' => ['label' => 'Edit research outputs', 'description' => 'Change recorded outputs and impact.'],
            'research_outputs.delete' => ['label' => 'Delete research outputs', 'description' => 'Remove recorded outputs.'],
            'research_outputs.record_any' => ['label' => 'Record outputs for any project', 'description' => 'Record outputs on projects within scope, not just their own.', 'roles' => ['super_admin', 'central_officer', $CO, ...$D]],
            'research_outputs.verify' => ['label' => 'Verify research outputs', 'description' => 'College verification of outputs.', 'roles' => [...$A, $CO]],
            'research_outputs.approve' => ['label' => 'Approve research outputs', 'description' => 'Final approval of outputs.', 'roles' => [...$A, ...$D]],
            'research_impacts.view_any' => ['label' => 'See research impact', 'description' => 'Publications, patents and awards.'],
            'research_impacts.create' => ['label' => 'Record research impact', 'description' => 'Add publications, patents and awards.'],
            'research_impacts.update' => ['label' => 'Edit research impact', 'description' => 'Change impact records.'],
            'research_impacts.delete' => ['label' => 'Delete research impact', 'description' => 'Remove impact records.'],
            'repository.view_any' => ['label' => 'See the repository', 'description' => 'Browse published research.'],
            'repository.manage' => ['label' => 'Publish to the repository', 'description' => 'Publish, edit, feature and archive repository records.', 'roles' => ['super_admin', 'central_officer']],
            'ethical_clearance.review' => ['label' => 'Review ethical clearance', 'description' => 'Verify ethics certificates.', 'roles' => [...$A, ...$D, $CO]],
            'no_cost_extensions.review' => ['label' => 'Review no-cost extensions', 'description' => 'Decide project time extensions.', 'roles' => [...$A, ...$D, $CO]],
            'closure.view' => ['label' => 'See closure checklists', 'description' => 'What each project still needs before closing.', 'roles' => [...$A, ...$D, $CO, 'support_officer']],
        ],

        'Finance' => [
            'budget_allocations.view_any' => ['label' => 'See budget allocations', 'description' => 'Open Budget Allocations.'],
            'budget_requests.create' => ['label' => 'Request budget', 'description' => 'Researchers: request funds for their own project.'],
            'budget_milestones.view' => ['label' => 'See budget milestones', 'description' => 'Milestones on the projects they can see.'],
            'budget_allocations.create' => ['label' => 'Allocate budgets', 'description' => 'Allocate and approve project budgets.'],
            'budget_requests.view_any' => ['label' => 'See budget requests', 'description' => 'Open Budget Requests.'],
            'budget_requests.approve_college' => ['label' => 'Approve budget requests (college)', 'description' => 'College-level review of budget requests.', 'roles' => [$CO]],
            'budget_requests.approve_finance' => ['label' => 'Approve budget requests (finance)', 'description' => 'Final finance approval, or return to the college.', 'roles' => [...$A, 'finance_officer', 'support_officer']],
            'budget_allocations.approve' => ['label' => 'Approve budget allocations', 'description' => 'Approve allocations (within scope).', 'roles' => ['super_admin', 'central_officer', ...$D]],
            'funds.disburse' => ['label' => 'Release funds', 'description' => 'Disburse an approved budget request.', 'roles' => [...$A, 'finance_officer', 'support_officer']],
            'budget_revisions.review' => ['label' => 'Review budget revisions', 'description' => 'Decide changes to approved budgets.', 'roles' => [...$A, $CO, 'finance_officer', 'support_officer']],
            'disbursements.view_any' => ['label' => 'See disbursements', 'description' => 'Open Disbursements.'],
            'disbursements.create' => ['label' => 'Disburse funds', 'description' => 'Release approved requests.'],
            'settlements.view_any' => ['label' => 'See settlements', 'description' => 'Open Settlements.'],
            'settlements.verify_college' => ['label' => 'Verify settlements (college)', 'description' => 'College verification of expense reports.', 'roles' => [...$A, $CO, 'finance_officer', 'support_officer']],
            'settlements.verify_finance' => ['label' => 'Verify settlements (finance)', 'description' => 'Final finance verification.', 'roles' => [...$A, 'finance_officer', 'support_officer']],
            'budget_milestones.view_any' => ['label' => 'See budget milestones', 'description' => 'Open Budget Milestones.'],
            'budget_milestones.update' => ['label' => 'Edit budget milestones', 'description' => 'Add and change milestones.'],
            'external_funds.view_any' => ['label' => 'External funds', 'description' => 'Agencies, opportunities, applications and awards from outside funders.'],
            'external_funds.manage' => ['label' => 'Manage external funds', 'description' => 'Create and edit agencies, opportunities, applications, awards, budgets and milestones.', 'roles' => [...$A, 'research_officer']],
            'external_funds.team' => ['label' => 'Manage external application teams', 'description' => 'Add and remove team members on external applications.', 'roles' => [...$A, 'research_officer', $CO]],
            'external_funds.expenditure' => ['label' => 'Record external fund spending', 'description' => 'Record expenditure against external awards.', 'roles' => [...$A, 'research_officer', 'finance_officer']],
            'external_funds.delete' => ['label' => 'Delete external funds records', 'description' => 'Delete agencies, opportunities, applications and awards.', 'roles' => ['super_admin', 'admin']],
        ],

        'Reports' => [
            'reports.view_any' => ['label' => 'See reports', 'description' => 'Open the reports area.'],
            'reports.create' => ['label' => 'Generate and build reports', 'description' => 'Generate reports and use the Report Builder (within scope).', 'roles' => [...$A, ...$D, $CO, $M]],
            'reports.view_all_snapshots' => ['label' => 'Open others\' saved reports', 'description' => 'Open reports generated by other users.', 'roles' => $A],
            'analytics.view' => ['label' => 'Analytics dashboard', 'description' => 'Submissions, pass rate, funnel and money.', 'roles' => [...$A, ...$D, $CO]],
            'turnaround.view' => ['label' => 'Turnaround', 'description' => 'Where proposals wait longest.', 'roles' => [...$A, ...$D, $CO]],
            'pipeline.view' => ['label' => 'Proposal pipeline', 'description' => 'Every proposal by stage.', 'roles' => [...$A, ...$D, $CO, $M]],
            'phase_completion.view' => ['label' => 'College phase completion', 'description' => 'Blind review and open defence progress per college.', 'roles' => [...$A, ...$D, $CO]],
            'annual_report.view' => ['label' => 'Annual RTT report', 'description' => 'The yearly summary report.', 'roles' => [...$A, $CO]],
            'calendar.all' => ['label' => 'See all deadlines in the calendar', 'description' => 'Calendar shows every college\'s defences and deadlines within scope.', 'roles' => [...$A, ...$D]],
        ],

        'Events' => [
            'conferences.manage' => ['label' => 'Manage conferences and abstracts', 'description' => 'Create conferences, assign abstract reviewers and decide abstracts.', 'roles' => ['super_admin', 'admin']],
        ],

        'Administration' => [
            'users.view_any' => ['label' => 'See users', 'description' => 'Open Users (college officers see their college).'],
            'users.create' => ['label' => 'Create users', 'description' => 'Create users.'],
            'users.update' => ['label' => 'Edit users', 'description' => 'Edit user details and status.'],
            'users.import' => ['label' => 'Import users', 'description' => 'Bulk-import users from a file.'],
            'users.manage' => ['label' => 'Bulk user actions and deletion', 'description' => 'Bulk actions, deleting users and seeing every college.', 'roles' => ['super_admin', 'admin']],
            'users.impersonate' => ['label' => 'Login as user', 'description' => 'See the platform as another user.'],
            'roles.assign' => ['label' => 'Assign roles to users', 'description' => 'Give users roles.'],
            'roles.manage' => ['label' => 'Manage roles and permissions', 'description' => 'Create, edit and delete roles and their permissions.', 'roles' => ['super_admin']],
            'colleges.view_any' => ['label' => 'See colleges', 'description' => 'Open Colleges.'],
            'colleges.create' => ['label' => 'Add colleges', 'description' => 'Add colleges.'],
            'colleges.update' => ['label' => 'Edit colleges', 'description' => 'Edit colleges.'],
            'colleges.delete' => ['label' => 'Delete colleges and departments', 'description' => 'Permanently delete colleges and departments.', 'roles' => ['super_admin']],
            'departments.view_any' => ['label' => 'Departments', 'description' => 'Open departments (college officers: their college).'],
            'departments.create' => ['label' => 'Add departments', 'description' => 'Add departments to a college.', 'roles' => $A],
            'thematic_areas.manage' => ['label' => 'Thematic areas', 'description' => 'Edit research thematic areas.', 'roles' => ['super_admin']],
            'lookup_options.view_any' => ['label' => 'See dropdown options', 'description' => 'Form choices across the platform.'],
            'lookup_options.update' => ['label' => 'Edit dropdown options', 'description' => 'Add, change and reorder form choices.'],
            'lookup_options.create' => ['label' => 'Add dropdown options', 'description' => 'Add new form choices.'],
            'lookup_options.delete' => ['label' => 'Delete dropdown options', 'description' => 'Remove form choices.'],
            'lookup_options.reorder' => ['label' => 'Reorder dropdown options', 'description' => 'Change the order of form choices.'],
            'settings.manage' => ['label' => 'Platform settings', 'description' => 'Settings, public site, broadcast email.'],
            'settings.restricted' => ['label' => 'Restricted settings', 'description' => 'Security, backups, integrations and other super-admin settings.', 'roles' => ['super_admin']],
            'features.manage' => ['label' => 'Feature management', 'description' => 'Switch modules and features on or off for everyone.', 'roles' => ['super_admin']],
            'content.manage' => ['label' => 'Public content', 'description' => 'FAQs, resources, login notices and feedback.', 'roles' => ['super_admin', 'admin']],
            'faqs.view_any' => ['label' => 'See FAQs (admin)', 'description' => 'Open the FAQ manager.'],
            'faqs.create' => ['label' => 'Add FAQs', 'description' => 'Add FAQ entries.'],
            'faqs.update' => ['label' => 'Edit FAQs', 'description' => 'Change FAQ entries.'],
            'faqs.delete' => ['label' => 'Delete FAQs', 'description' => 'Remove FAQ entries.'],
            'faqs.reorder' => ['label' => 'Reorder FAQs', 'description' => 'Change the order of FAQs.'],
            'help.manage' => ['label' => 'Help articles', 'description' => 'Edit help articles and see what people ask.', 'roles' => ['super_admin', 'admin']],
            'data_requests.manage' => ['label' => 'Data deletion requests', 'description' => 'Approve or decline requests to remove personal data.', 'roles' => ['super_admin', 'admin']],
            'audit_logs.view_any' => ['label' => 'Audit logs', 'description' => 'Every change, who made it and when.'],
            'system_monitor.view_any' => ['label' => 'System monitor', 'description' => 'Server health, queue and emails.'],
            'system_monitor.manage' => ['label' => 'System maintenance', 'description' => 'Retry failed jobs, clear caches, alerting settings.', 'roles' => ['super_admin']],
        ],
    ],
];
