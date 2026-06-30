<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class User360Service
{
    public function build(User $user): array
    {
        $uid = $user->id;

        // ── PROPOSALS AS PI ───────────────────────────────────────────────
        $proposalsAsPi = DB::table('proposals')
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->join('departments', 'proposals.department_id', '=', 'departments.id')
            ->leftJoin('awards', 'proposals.id', '=', 'awards.proposal_id')
            ->where('proposals.pi_user_id', $uid)
            ->whereNull('proposals.deleted_at')
            ->select([
                'proposals.id', 'proposals.tracker_number', 'proposals.title',
                'proposals.status', 'proposals.category', 'proposals.academic_year',
                'proposals.submitted_at', 'proposals.created_at',
                'colleges.name as college_name', 'departments.name as department_name',
                'awards.awarded_amount',
            ])
            ->orderByDesc('proposals.created_at')
            ->get();

        // ── PROPOSALS AS CO-PI / MEMBER ───────────────────────────────────
        $proposalsAsMember = DB::table('proposal_members')
            ->join('proposals', 'proposal_members.proposal_id', '=', 'proposals.id')
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->join('users as pi', 'proposals.pi_user_id', '=', 'pi.id')
            ->leftJoin('awards', 'proposals.id', '=', 'awards.proposal_id')
            ->where('proposal_members.user_id', $uid)
            ->whereNull('proposals.deleted_at')
            ->select([
                'proposals.id', 'proposals.tracker_number', 'proposals.title',
                'proposals.status', 'proposals.category', 'proposals.academic_year',
                'proposals.submitted_at', 'proposals.created_at',
                'proposal_members.role as member_role',
                'proposal_members.contribution_percentage',
                'proposal_members.status as member_status',
                'colleges.name as college_name',
                'pi.name as pi_name',
                'awards.awarded_amount',
            ])
            ->orderByDesc('proposals.created_at')
            ->get();

        // ── REVIEW ASSIGNMENTS ────────────────────────────────────────────
        $reviewAssignments = DB::table('review_assignments')
            ->join('proposals', 'review_assignments.proposal_id', '=', 'proposals.id')
            ->join('evaluation_types', 'review_assignments.evaluation_type_id', '=', 'evaluation_types.id')
            ->join('users as assigner', 'review_assignments.assigned_by', '=', 'assigner.id')
            ->where('review_assignments.reviewer_id', $uid)
            ->select([
                'review_assignments.id', 'review_assignments.status',
                'review_assignments.assigned_at', 'review_assignments.due_date',
                'review_assignments.submitted_at', 'review_assignments.is_external',
                'proposals.id as proposal_id', 'proposals.tracker_number',
                'proposals.title as proposal_title', 'proposals.status as proposal_status',
                'evaluation_types.name as evaluation_type',
                'assigner.name as assigned_by_name',
            ])
            ->orderByDesc('review_assignments.assigned_at')
            ->get();

        $reviewScoreCount = DB::table('review_scores')
            ->join('review_assignments', 'review_scores.review_assignment_id', '=', 'review_assignments.id')
            ->where('review_assignments.reviewer_id', $uid)
            ->count();

        // ── ASSIGNMENTS MADE BY THIS USER ─────────────────────────────────
        $assignmentsMade = DB::table('review_assignments')
            ->join('proposals', 'review_assignments.proposal_id', '=', 'proposals.id')
            ->join('users as reviewer', 'review_assignments.reviewer_id', '=', 'reviewer.id')
            ->where('review_assignments.assigned_by', $uid)
            ->select([
                'proposals.tracker_number', 'proposals.title as proposal_title',
                'reviewer.name as reviewer_name', 'review_assignments.status',
                'review_assignments.assigned_at',
            ])
            ->orderByDesc('review_assignments.assigned_at')
            ->limit(30)
            ->get();

        // ── WORKFLOW ACTIONS ──────────────────────────────────────────────
        $workflowActions = DB::table('workflow_logs')
            ->join('proposals', 'workflow_logs.proposal_id', '=', 'proposals.id')
            ->where('workflow_logs.actor_id', $uid)
            ->select([
                'workflow_logs.id', 'workflow_logs.action', 'workflow_logs.from_stage',
                'workflow_logs.to_stage', 'workflow_logs.notes', 'workflow_logs.created_at',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('workflow_logs.created_at')
            ->limit(60)
            ->get();

        // ── BUDGET REQUESTS ───────────────────────────────────────────────
        $budgetRequests = DB::table('budget_requests')
            ->join('proposals', 'budget_requests.proposal_id', '=', 'proposals.id')
            ->where('budget_requests.requested_by', $uid)
            ->select([
                'budget_requests.id', 'budget_requests.total_amount', 'budget_requests.status',
                'budget_requests.funding_round', 'budget_requests.submitted_at',
                'budget_requests.created_at',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('budget_requests.created_at')
            ->get();

        // ── BUDGET APPROVALS ──────────────────────────────────────────────
        $budgetApprovals = DB::table('budget_approvals')
            ->join('budget_requests', 'budget_approvals.budget_request_id', '=', 'budget_requests.id')
            ->join('proposals', 'budget_requests.proposal_id', '=', 'proposals.id')
            ->where('budget_approvals.approved_by', $uid)
            ->select([
                'budget_approvals.id', 'budget_approvals.approval_type',
                'budget_approvals.approved_at', 'budget_approvals.notes',
                'budget_requests.total_amount',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('budget_approvals.approved_at')
            ->get();

        // ── DISBURSEMENTS ─────────────────────────────────────────────────
        $disbursements = DB::table('disbursements')
            ->join('budget_requests', 'disbursements.budget_request_id', '=', 'budget_requests.id')
            ->join('proposals', 'budget_requests.proposal_id', '=', 'proposals.id')
            ->where('disbursements.disbursed_by', $uid)
            ->select([
                'disbursements.id', 'disbursements.amount', 'disbursements.disbursed_at',
                'disbursements.transaction_id',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('disbursements.disbursed_at')
            ->get();

        // ── BUDGET SETTLEMENTS ────────────────────────────────────────────
        $settlementsSubmitted = DB::table('budget_settlements')
            ->join('budget_requests', 'budget_settlements.budget_request_id', '=', 'budget_requests.id')
            ->join('proposals', 'budget_requests.proposal_id', '=', 'proposals.id')
            ->where('budget_settlements.submitted_by', $uid)
            ->select([
                'budget_settlements.id', 'budget_settlements.status',
                'budget_settlements.total_spent', 'budget_settlements.created_at',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('budget_settlements.created_at')
            ->get();

        // ── MIDTERM EVALUATIONS ───────────────────────────────────────────
        $midtermScheduled = DB::table('midterm_evaluations')
            ->join('proposals', 'midterm_evaluations.proposal_id', '=', 'proposals.id')
            ->where('midterm_evaluations.scheduled_by', $uid)
            ->select([
                'midterm_evaluations.id', 'midterm_evaluations.evaluation_date',
                'midterm_evaluations.status', 'midterm_evaluations.progress_score',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('midterm_evaluations.evaluation_date')
            ->get();

        $midtermScored = DB::table('midterm_evaluations')
            ->join('proposals', 'midterm_evaluations.proposal_id', '=', 'proposals.id')
            ->where('midterm_evaluations.scored_by', $uid)
            ->where('midterm_evaluations.scheduled_by', '!=', $uid)
            ->select([
                'midterm_evaluations.id', 'midterm_evaluations.evaluation_date',
                'midterm_evaluations.status', 'midterm_evaluations.progress_score',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('midterm_evaluations.evaluation_date')
            ->get();

        // ── RESEARCH OUTPUTS ──────────────────────────────────────────────
        $researchOutputs = DB::table('research_outputs')
            ->join('proposals', 'research_outputs.proposal_id', '=', 'proposals.id')
            ->where('research_outputs.recorded_by', $uid)
            ->select([
                'research_outputs.id', 'research_outputs.output_type',
                'research_outputs.title', 'research_outputs.created_at',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('research_outputs.created_at')
            ->get();

        // ── COMPLAINTS FILED ──────────────────────────────────────────────
        $complaintsFiled = DB::table('complaints')
            ->join('proposals', 'complaints.proposal_id', '=', 'proposals.id')
            ->where('complaints.complainant_id', $uid)
            ->select([
                'complaints.id', 'complaints.stage', 'complaints.status',
                'complaints.created_at', 'complaints.resolved_at',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('complaints.created_at')
            ->get();

        // ── COMPLAINTS HANDLED ────────────────────────────────────────────
        $complaintsHandled = DB::table('complaints')
            ->join('proposals', 'complaints.proposal_id', '=', 'proposals.id')
            ->where(fn ($q) => $q
                ->where('complaints.assigned_to', $uid)
                ->orWhere('complaints.resolved_by', $uid))
            ->where('complaints.complainant_id', '!=', $uid)
            ->select([
                'complaints.id', 'complaints.stage', 'complaints.status',
                'complaints.created_at', 'complaints.resolved_at',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('complaints.created_at')
            ->get();

        // ── APPEALS ───────────────────────────────────────────────────────
        $appealsSubmitted = DB::table('proposal_appeals')
            ->join('proposals', 'proposal_appeals.proposal_id', '=', 'proposals.id')
            ->where('proposal_appeals.submitted_by', $uid)
            ->select([
                'proposal_appeals.id', 'proposal_appeals.status',
                'proposal_appeals.created_at', 'proposal_appeals.resolved_at',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('proposal_appeals.created_at')
            ->get();

        $appealsResolved = DB::table('proposal_appeals')
            ->join('proposals', 'proposal_appeals.proposal_id', '=', 'proposals.id')
            ->where('proposal_appeals.resolved_by', $uid)
            ->select([
                'proposal_appeals.id', 'proposal_appeals.status', 'proposal_appeals.resolved_at',
                'proposals.tracker_number', 'proposals.title as proposal_title',
            ])
            ->orderByDesc('proposal_appeals.resolved_at')
            ->get();

        // ── EXTERNAL FUND APPLICATIONS ────────────────────────────────────
        $efApplications = DB::table('ef_applications')
            ->join('ef_agencies', 'ef_applications.agency_id', '=', 'ef_agencies.id')
            ->where('ef_applications.pi_user_id', $uid)
            ->select([
                'ef_applications.id', 'ef_applications.ref_number', 'ef_applications.title',
                'ef_applications.status', 'ef_applications.amount_requested',
                'ef_applications.currency', 'ef_applications.submitted_at',
                'ef_applications.created_at', 'ef_agencies.name as agency_name',
            ])
            ->orderByDesc('ef_applications.created_at')
            ->get();

        $efMemberships = DB::table('ef_team_members')
            ->join('ef_applications', 'ef_team_members.application_id', '=', 'ef_applications.id')
            ->join('ef_agencies', 'ef_applications.agency_id', '=', 'ef_agencies.id')
            ->join('users as pi', 'ef_applications.pi_user_id', '=', 'pi.id')
            ->where('ef_team_members.user_id', $uid)
            ->select([
                'ef_team_members.id', 'ef_team_members.role',
                'ef_applications.ref_number', 'ef_applications.title',
                'ef_applications.status', 'ef_agencies.name as agency_name',
                'pi.name as pi_name',
            ])
            ->orderByDesc('ef_applications.created_at')
            ->get();

        $efReviews = DB::table('ef_reviews')
            ->join('ef_applications', 'ef_reviews.application_id', '=', 'ef_applications.id')
            ->join('ef_agencies', 'ef_applications.agency_id', '=', 'ef_agencies.id')
            ->where('ef_reviews.reviewer_id', $uid)
            ->select([
                'ef_reviews.id', 'ef_reviews.stage', 'ef_reviews.status',
                'ef_reviews.reviewed_at', 'ef_applications.ref_number',
                'ef_applications.title', 'ef_agencies.name as agency_name',
            ])
            ->orderByDesc('ef_reviews.reviewed_at')
            ->get();

        // ── CONFERENCE ABSTRACT REVIEWS ───────────────────────────────────
        $abstractReviews = DB::table('conference_abstract_reviews')
            ->join('conference_abstracts', 'conference_abstract_reviews.abstract_id', '=', 'conference_abstracts.id')
            ->join('conferences', 'conference_abstracts.conference_id', '=', 'conferences.id')
            ->where('conference_abstract_reviews.reviewer_id', $uid)
            ->select([
                'conference_abstract_reviews.id', 'conference_abstract_reviews.score',
                'conference_abstract_reviews.recommendation',
                'conference_abstract_reviews.submitted_at',
                'conference_abstracts.title as abstract_title',
                'conferences.title as conference_title',
            ])
            ->orderByDesc('conference_abstract_reviews.submitted_at')
            ->get();

        // ── AUDIT LOG ─────────────────────────────────────────────────────
        $auditLogCount = DB::table('audit_logs')->where('actor_id', $uid)->count();
        $recentAuditLogs = DB::table('audit_logs')
            ->where('actor_id', $uid)
            ->select(['id', 'auditable_type', 'auditable_id', 'event', 'ip_address', 'created_at'])
            ->orderByDesc('created_at')
            ->limit(15)
            ->get();

        // ── NOTIFICATIONS ─────────────────────────────────────────────────
        $notificationsTotal = DB::table('notifications')
            ->where('notifiable_id', $uid)
            ->where('notifiable_type', 'App\\Models\\User')
            ->count();
        $notificationsUnread = DB::table('notifications')
            ->where('notifiable_id', $uid)
            ->where('notifiable_type', 'App\\Models\\User')
            ->whereNull('read_at')
            ->count();

        // ── ACTIVE SESSIONS ───────────────────────────────────────────────
        $activeSessions = DB::table('personal_access_tokens')
            ->where('tokenable_id', $uid)
            ->where('tokenable_type', 'App\\Models\\User')
            ->select(['id', 'name', 'last_used_at', 'created_at'])
            ->orderByDesc('last_used_at')
            ->get();

        // ── FEEDBACK ──────────────────────────────────────────────────────
        $feedback = DB::table('feedback_submissions')
            ->where('user_id', $uid)
            ->select(['type', 'rating', 'message', 'created_at'])
            ->first();

        // ── TOTAL FUNDED AMOUNT (as PI) ───────────────────────────────────
        $totalFundedAmount = (float) DB::table('awards')
            ->join('proposals', 'awards.proposal_id', '=', 'proposals.id')
            ->where('proposals.pi_user_id', $uid)
            ->sum('awards.awarded_amount');

        $summary = [
            'proposals_as_pi' => $proposalsAsPi->count(),
            'proposals_as_member' => $proposalsAsMember->count(),
            'reviews_assigned' => $reviewAssignments->count(),
            'reviews_completed' => $reviewAssignments->where('status', 'submitted')->count(),
            'reviews_pending' => $reviewAssignments->whereIn('status', ['pending', 'in_progress'])->count(),
            'review_scores_given' => $reviewScoreCount,
            'assignments_made' => $assignmentsMade->count(),
            'workflow_actions' => $workflowActions->count(),
            'budget_requests' => $budgetRequests->count(),
            'budget_approvals' => $budgetApprovals->count(),
            'disbursements' => $disbursements->count(),
            'disbursements_total' => (float) $disbursements->sum('amount'),
            'ef_applications' => $efApplications->count(),
            'ef_memberships' => $efMemberships->count(),
            'ef_reviews' => $efReviews->count(),
            'abstract_reviews' => $abstractReviews->count(),
            'complaints_filed' => $complaintsFiled->count(),
            'complaints_handled' => $complaintsHandled->count(),
            'appeals_submitted' => $appealsSubmitted->count(),
            'appeals_resolved' => $appealsResolved->count(),
            'midterm_scheduled' => $midtermScheduled->count(),
            'midterm_scored' => $midtermScored->count(),
            'research_outputs' => $researchOutputs->count(),
            'audit_actions' => $auditLogCount,
            'notifications_total' => $notificationsTotal,
            'notifications_unread' => $notificationsUnread,
            'active_sessions' => $activeSessions->count(),
            'total_funded_amount' => $totalFundedAmount,
        ];

        return [
            'summary' => $summary,
            'proposals_as_pi' => $proposalsAsPi->values(),
            'proposals_as_member' => $proposalsAsMember->values(),
            'review_assignments' => $reviewAssignments->values(),
            'assignments_made' => $assignmentsMade->values(),
            'workflow_actions' => $workflowActions->values(),
            'budget_requests' => $budgetRequests->values(),
            'budget_approvals' => $budgetApprovals->values(),
            'disbursements' => $disbursements->values(),
            'settlements' => $settlementsSubmitted->values(),
            'midterm_scheduled' => $midtermScheduled->values(),
            'midterm_scored' => $midtermScored->values(),
            'research_outputs' => $researchOutputs->values(),
            'complaints_filed' => $complaintsFiled->values(),
            'complaints_handled' => $complaintsHandled->values(),
            'appeals_submitted' => $appealsSubmitted->values(),
            'appeals_resolved' => $appealsResolved->values(),
            'ef_applications' => $efApplications->values(),
            'ef_memberships' => $efMemberships->values(),
            'ef_reviews' => $efReviews->values(),
            'abstract_reviews' => $abstractReviews->values(),
            'recent_audit_logs' => $recentAuditLogs->values(),
            'active_sessions' => $activeSessions->values(),
            'notifications_total' => $notificationsTotal,
            'notifications_unread' => $notificationsUnread,
            'feedback' => $feedback,
        ];
    }

    /** Unified chronological event feed across all tables. */
    public function buildTimeline(User $user): array
    {
        $uid = $user->id;
        $events = [];

        // Proposals created / submitted as PI
        DB::table('proposals')
            ->where('pi_user_id', $uid)
            ->whereNull('deleted_at')
            ->select(['tracker_number', 'title', 'status', 'category', 'created_at', 'submitted_at'])
            ->get()
            ->each(function ($p) use (&$events) {
                $events[] = ['type' => 'proposal_created', 'icon' => 'file', 'color' => 'blue',
                    'title' => 'Created proposal', 'description' => "{$p->tracker_number} — {$p->title}",
                    'sub' => ucfirst($p->category ?? ''), 'date' => $p->created_at];
                if ($p->submitted_at) {
                    $events[] = ['type' => 'proposal_submitted', 'icon' => 'send', 'color' => 'indigo',
                        'title' => 'Submitted proposal', 'description' => "{$p->tracker_number} — {$p->title}",
                        'sub' => 'Status: '.str_replace('_', ' ', $p->status), 'date' => $p->submitted_at];
                }
            });

        // Workflow actions
        DB::table('workflow_logs')
            ->join('proposals', 'workflow_logs.proposal_id', '=', 'proposals.id')
            ->where('workflow_logs.actor_id', $uid)
            ->select(['workflow_logs.action', 'workflow_logs.from_stage', 'workflow_logs.to_stage',
                'workflow_logs.notes', 'workflow_logs.created_at',
                'proposals.tracker_number', 'proposals.title as proposal_title'])
            ->get()
            ->each(function ($w) use (&$events) {
                $events[] = ['type' => 'workflow_action', 'icon' => 'zap', 'color' => 'teal',
                    'title' => ucfirst(str_replace('_', ' ', $w->action)),
                    'description' => "{$w->tracker_number} — {$w->proposal_title}",
                    'sub' => str_replace('_', ' ', $w->from_stage).' → '.str_replace('_', ' ', $w->to_stage),
                    'date' => $w->created_at];
            });

        // Review assignments received / submitted
        DB::table('review_assignments')
            ->join('proposals', 'review_assignments.proposal_id', '=', 'proposals.id')
            ->where('review_assignments.reviewer_id', $uid)
            ->select(['review_assignments.status', 'review_assignments.assigned_at',
                'review_assignments.submitted_at',
                'proposals.tracker_number', 'proposals.title as proposal_title'])
            ->get()
            ->each(function ($r) use (&$events) {
                $events[] = ['type' => 'review_assigned', 'icon' => 'star', 'color' => 'amber',
                    'title' => 'Assigned as reviewer', 'description' => "{$r->tracker_number} — {$r->proposal_title}",
                    'sub' => '', 'date' => $r->assigned_at];
                if ($r->submitted_at) {
                    $events[] = ['type' => 'review_submitted', 'icon' => 'check', 'color' => 'green',
                        'title' => 'Submitted review', 'description' => "{$r->tracker_number} — {$r->proposal_title}",
                        'sub' => '', 'date' => $r->submitted_at];
                }
            });

        // Budget requests submitted
        DB::table('budget_requests')
            ->join('proposals', 'budget_requests.proposal_id', '=', 'proposals.id')
            ->where('budget_requests.requested_by', $uid)
            ->whereNotNull('budget_requests.submitted_at')
            ->select(['budget_requests.total_amount', 'budget_requests.funding_round',
                'budget_requests.submitted_at',
                'proposals.tracker_number', 'proposals.title as proposal_title'])
            ->get()
            ->each(function ($b) use (&$events) {
                $events[] = ['type' => 'budget_submitted', 'icon' => 'dollar', 'color' => 'amber',
                    'title' => 'Submitted budget request',
                    'description' => "{$b->tracker_number} — {$b->proposal_title}",
                    'sub' => 'Round '.$b->funding_round.' · ETB '.number_format($b->total_amount, 2),
                    'date' => $b->submitted_at];
            });

        // Budget approvals given
        DB::table('budget_approvals')
            ->join('budget_requests', 'budget_approvals.budget_request_id', '=', 'budget_requests.id')
            ->join('proposals', 'budget_requests.proposal_id', '=', 'proposals.id')
            ->where('budget_approvals.approved_by', $uid)
            ->select(['budget_approvals.approval_type', 'budget_approvals.approved_at',
                'proposals.tracker_number', 'proposals.title as proposal_title'])
            ->get()
            ->each(function ($a) use (&$events) {
                $events[] = ['type' => 'budget_approved', 'icon' => 'check_circle', 'color' => 'green',
                    'title' => ucfirst($a->approval_type).' budget approval',
                    'description' => "{$a->tracker_number} — {$a->proposal_title}",
                    'sub' => '', 'date' => $a->approved_at];
            });

        // Research outputs recorded
        DB::table('research_outputs')
            ->join('proposals', 'research_outputs.proposal_id', '=', 'proposals.id')
            ->where('research_outputs.recorded_by', $uid)
            ->select(['research_outputs.output_type', 'research_outputs.title',
                'research_outputs.created_at', 'proposals.tracker_number'])
            ->get()
            ->each(function ($o) use (&$events) {
                $events[] = ['type' => 'output_recorded', 'icon' => 'microscope', 'color' => 'teal',
                    'title' => 'Recorded '.str_replace('_', ' ', $o->output_type),
                    'description' => $o->title,
                    'sub' => "On {$o->tracker_number}", 'date' => $o->created_at];
            });

        // Complaints filed
        DB::table('complaints')
            ->join('proposals', 'complaints.proposal_id', '=', 'proposals.id')
            ->where('complaints.complainant_id', $uid)
            ->select(['complaints.stage', 'complaints.created_at',
                'proposals.tracker_number', 'proposals.title as proposal_title'])
            ->get()
            ->each(function ($c) use (&$events) {
                $events[] = ['type' => 'complaint_filed', 'icon' => 'flag', 'color' => 'red',
                    'title' => 'Filed complaint', 'description' => "{$c->tracker_number} — {$c->proposal_title}",
                    'sub' => 'Stage: '.str_replace('_', ' ', $c->stage), 'date' => $c->created_at];
            });

        // Appeals submitted / resolved
        DB::table('proposal_appeals')
            ->join('proposals', 'proposal_appeals.proposal_id', '=', 'proposals.id')
            ->where('proposal_appeals.submitted_by', $uid)
            ->select(['proposal_appeals.status', 'proposal_appeals.created_at', 'proposal_appeals.resolved_at',
                'proposals.tracker_number', 'proposals.title as proposal_title'])
            ->get()
            ->each(function ($a) use (&$events) {
                $events[] = ['type' => 'appeal_submitted', 'icon' => 'scale', 'color' => 'yellow',
                    'title' => 'Submitted appeal', 'description' => "{$a->tracker_number} — {$a->proposal_title}",
                    'sub' => 'Status: '.$a->status, 'date' => $a->created_at];
            });

        // EF applications submitted
        DB::table('ef_applications')
            ->join('ef_agencies', 'ef_applications.agency_id', '=', 'ef_agencies.id')
            ->where('ef_applications.pi_user_id', $uid)
            ->whereNotNull('ef_applications.submitted_at')
            ->select(['ef_applications.title', 'ef_applications.submitted_at',
                'ef_agencies.name as agency_name'])
            ->get()
            ->each(function ($a) use (&$events) {
                $events[] = ['type' => 'ef_submitted', 'icon' => 'globe', 'color' => 'rose',
                    'title' => 'Submitted EF application', 'description' => $a->title,
                    'sub' => $a->agency_name, 'date' => $a->submitted_at];
            });

        // Sort descending by date
        usort($events, fn ($a, $b) => strtotime($b['date']) - strtotime($a['date']));

        return array_slice($events, 0, 200);
    }

    /** Daily audit-log activity for the last 365 days. */
    public function buildHeatmap(User $user): array
    {
        $uid = $user->id;

        $counts = DB::table('audit_logs')
            ->where('actor_id', $uid)
            ->where('created_at', '>=', now()->subDays(364))
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date')
            ->get()
            ->keyBy('date')
            ->map(fn ($r) => (int) $r->count);

        $days = [];
        for ($i = 364; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $days[] = ['date' => $date, 'count' => $counts[$date] ?? 0];
        }

        return $days;
    }
}
