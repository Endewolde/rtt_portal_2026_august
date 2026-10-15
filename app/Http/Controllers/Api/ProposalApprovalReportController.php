<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\ProposalApprovalReport;
use App\Models\User;
use App\Services\ApprovalReportService;
use App\Services\WorkflowService;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * College officers can't reject a proposal out of blind review themselves (that's
 * restricted to central_officer/super_admin/category officers — see
 * ReviewController::rejectFromBlindReview) — this is how they flag a proposal they
 * believe was mistakenly approved past validation to the people who can act on it.
 *
 * Filing a report also pulls the proposal back to 'validated' (via the
 * return_for_investigation workflow transition) so it lands back in the category
 * officer's queue with a real next action available — reject it (validated -> reject,
 * same as ProposalValidationController::reject) or re-assign reviewers to proceed.
 */
class ProposalApprovalReportController extends Controller
{
    public function __construct(
        private WorkflowService $workflowService,
        private ApprovalReportService $approvalReports,
    ) {}

    private const CATEGORY_ROLE_MAP = [
        'research' => 'research_officer',
        'community_engagement' => 'community_officer',
        'technology_transfer' => 'technology_officer',
    ];

    private const REPORTABLE_STATUSES = ['validated', 'under_blind_review', 'blind_review_passed'];

    private const REVIEWER_ROLES = ['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'];

    private const OUTCOME_APPROVAL_STANDS = 'approval_stands';

    private const OUTCOME_APPROVAL_REVOKED = 'approval_revoked';

    /** College officer flags a proposal in blind review as possibly mistakenly approved. */
    public function store(string $proposalId, Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasRole('college_officer')) {
            return response()->json(['data' => null, 'message' => 'Only college officers can report a mistaken approval.', 'errors' => []], 403);
        }

        $request->validate([
            'issue_type' => ['required', Rule::in(array_keys(ProposalApprovalReport::ISSUE_TYPES))],
            'reason' => 'nullable|required_if:issue_type,other|string|min:10|max:2000',
        ], [
            'issue_type.required' => 'Please select what is wrong with this proposal.',
            'reason.required_if' => 'Please describe the issue.',
        ]);

        $proposal = Proposal::findOrFail($proposalId);

        if ($request->_college_scope && $proposal->college_id !== $request->_college_scope) {
            return response()->json(['data' => null, 'message' => 'You can only report proposals from your own college.', 'errors' => []], 403);
        }

        if (! in_array($proposal->status, self::REPORTABLE_STATUSES, true)) {
            return response()->json(['data' => null, 'message' => 'Only proposals currently in blind review can be reported.', 'errors' => []], 422);
        }

        if (ProposalApprovalReport::where('proposal_id', $proposalId)->where('status', 'open')->exists()) {
            return response()->json(['data' => null, 'message' => 'A report is already open for this proposal.', 'errors' => []], 422);
        }

        // Reporting again after a director decided the approval stands: say what is new.
        $previouslyUpheld = ProposalApprovalReport::where('proposal_id', $proposalId)
            ->where('status', 'reviewed')
            ->where('outcome', self::OUTCOME_APPROVAL_STANDS)
            ->exists();

        if ($previouslyUpheld && mb_strlen(trim((string) $request->reason)) < 10) {
            return response()->json([
                'data' => null,
                'message' => 'This proposal was reported before and the approval stood. Explain what is new (at least 10 characters).',
                'errors' => ['reason' => ['Explain what is new since the last report was reviewed.']],
            ], 422);
        }

        $returnedForInvestigation = $proposal->status !== 'validated';

        try {
            $report = DB::transaction(function () use ($proposal, $proposalId, $user, $request, $returnedForInvestigation) {
                $report = ProposalApprovalReport::create([
                    'proposal_id' => $proposalId,
                    'reported_by' => $user->id,
                    'issue_type' => $request->issue_type,
                    'reason' => $request->reason,
                    'status' => 'open',
                    'returned_from_status' => $returnedForInvestigation ? $proposal->status : null,
                ]);

                // Pull the proposal back out of blind review so the category/central
                // officer gets a real next action, instead of it silently sitting
                // where it was.
                if ($returnedForInvestigation) {
                    $this->workflowService->transition($proposal, 'return_for_investigation', $user, $report->summary);
                }

                return $report;
            });
        } catch (\Exception $e) {
            Log::error("Failed to file approval report for proposal {$proposalId}: {$e->getMessage()}");

            return response()->json([
                'data' => null,
                'message' => 'Report could not be filed — the proposal could not be returned for review. Please contact an administrator.',
                'errors' => [],
            ], 422);
        }

        AuditLogger::log('proposal.approval_reported', Proposal::class, $proposalId, $user->id, null, [
            'tracker' => $proposal->tracker_number,
            'returned_for_investigation' => $returnedForInvestigation,
        ]);

        $this->notifyReviewers($proposal, $user, $report);

        return response()->json([
            'data' => $report,
            'message' => $returnedForInvestigation
                ? 'Reported. The proposal has been returned to validated status for the category officer to review.'
                : 'Reported. Central office and the category officer have been notified.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    /** Reports filed against a proposal — for the banner on the proposal detail page. */
    public function index(string $proposalId, Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole([...self::REVIEWER_ROLES, 'college_officer'])) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $reports = ProposalApprovalReport::where('proposal_id', $proposalId)
            ->with(['reportedBy:id,name', 'reviewedBy:id,name'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $reports, 'message' => '', 'errors' => []]);
    }

    /**
     * All approval reports across proposals. Central/category officers get the full
     * work queue (scoped by category/college like the rest of the app) since they're
     * the ones who resolve reports. A college_officer isn't in that resolving role, but
     * still needs to know whether the reports THEY filed have been acted on — so they
     * get the same page, scoped down to only the reports they personally reported.
     */
    public function indexAll(Request $request): JsonResponse
    {
        $user = $request->user();
        $isReviewer = $user?->hasAnyRole(self::REVIEWER_ROLES);
        $isReportingOfficer = $user?->hasRole('college_officer');

        if (! $isReviewer && ! $isReportingOfficer) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $reports = ProposalApprovalReport::with([
            'proposal:id,tracker_number,title,category,college_id,status',
            'proposal.college:id,name',
            'reportedBy:id,name',
            'reviewedBy:id,name',
        ])
            ->when(! $isReviewer, fn ($q) => $q->where('reported_by', $user->id))
            ->when($isReviewer, function ($q) use ($request) {
                $q->whereHas('proposal', function ($pq) use ($request) {
                    if ($request->_category_scope) {
                        $pq->where('category', $request->_category_scope);
                    } elseif ($request->filled('category')) {
                        $pq->where('category', $request->category);
                    }

                    if ($request->_college_scope) {
                        $pq->where('college_id', $request->_college_scope);
                    } elseif ($request->filled('college_id')) {
                        $pq->where('college_id', $request->college_id);
                    }
                });
            })
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        $reports->getCollection()->each(
            fn (ProposalApprovalReport $report) => $report->setAttribute('can_report_again', $this->canReportAgain($report, $user))
        );

        return response()->json(['data' => $reports, 'message' => '', 'errors' => [], 'meta' => ['can_resolve' => (bool) $isReviewer]]);
    }

    /**
     * The reporting college officer cancels their report while it is still open.
     * If filing it pulled the proposal back to validated, it is put back where it
     * was — but only if nobody has acted on the proposal since (it is still sitting
     * at validated); otherwise the report has effectively been acted on already.
     */
    public function withdraw(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $report = ProposalApprovalReport::with('proposal')->findOrFail($id);
        $proposal = $report->proposal;

        if ($report->reported_by !== $user?->id) {
            return response()->json(['data' => null, 'message' => 'Only the officer who filed this report can cancel it.', 'errors' => []], 403);
        }

        if ($report->status !== 'open') {
            return response()->json([
                'data' => null,
                'message' => $report->status === 'reviewed'
                    ? 'This report has already been reviewed and can no longer be cancelled.'
                    : 'This report has already been cancelled.',
                'errors' => [],
            ], 422);
        }

        if (! $proposal || $proposal->status !== 'validated') {
            return response()->json([
                'data' => null,
                'message' => 'This report has already been acted on — the proposal is now '.Proposal::statusLabel($proposal?->status).' — so it can no longer be cancelled.',
                'errors' => [],
            ], 422);
        }

        try {
            $restoredTo = DB::transaction(function () use ($report, $proposal, $user) {
                $report->update(['status' => 'withdrawn', 'withdrawn_at' => now()]);

                return $this->approvalReports->restoreProposal(
                    $report,
                    $proposal,
                    $user,
                    'Mistaken-approval report cancelled by the reporting officer — proposal returned to its previous stage.'
                );
            });
        } catch (\Exception $e) {
            Log::error("Failed to withdraw approval report {$id}: {$e->getMessage()}");

            return response()->json([
                'data' => null,
                'message' => 'The report could not be cancelled — the proposal could not be returned to its previous stage. Please contact an administrator.',
                'errors' => [],
            ], 422);
        }

        $this->approvalReports->continueFrom($proposal, $restoredTo);

        AuditLogger::log('proposal.approval_report_withdrawn', Proposal::class, $proposal->id, $user->id, ['report_status' => 'open'], [
            'report_status' => 'withdrawn',
            'restored_to' => $restoredTo,
        ]);

        $this->notifyWithdrawn($proposal, $user);

        return response()->json([
            'data' => $report->fresh(['reportedBy:id,name']),
            'message' => $restoredTo
                ? 'Report cancelled. The proposal has been returned to '.Proposal::statusLabel($restoredTo).'.'
                : 'Report cancelled.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * The central office or the proposal's category officer decides a report:
     *  - approval_stands: the report is closed and the proposal returns to the stage
     *    the report pulled it from, then carries on from there — if every blind
     *    review score came in meanwhile, the normal automatic decision runs now.
     *  - approval_revoked: the proposal is rejected, with both officers' notes as the
     *    reason the PI and co-investigators are told; outstanding reviewer assignments
     *    are cancelled by CancelReviewAssignmentsOnRejection.
     */
    public function resolve(string $id, Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasAnyRole(self::REVIEWER_ROLES)) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'outcome' => 'required|in:'.self::OUTCOME_APPROVAL_STANDS.','.self::OUTCOME_APPROVAL_REVOKED,
            'resolution_notes' => 'required|string|min:10|max:2000',
        ]);

        $report = ProposalApprovalReport::with(['proposal', 'reportedBy'])->findOrFail($id);
        $proposal = $report->proposal;

        if ($request->_category_scope && $proposal?->category !== $request->_category_scope) {
            return response()->json(['data' => null, 'message' => 'You can only resolve reports for proposals in your own category.', 'errors' => []], 403);
        }

        if ($report->status !== 'open') {
            return response()->json([
                'data' => null,
                'message' => $report->status === 'withdrawn'
                    ? 'This report was cancelled by the officer who filed it.'
                    : 'This report has already been resolved.',
                'errors' => [],
            ], 422);
        }

        if (! $proposal || ! in_array($proposal->status, self::REPORTABLE_STATUSES, true)) {
            return response()->json([
                'data' => null,
                'message' => 'The proposal is now '.Proposal::statusLabel($proposal?->status).', so this report can no longer be resolved from here.',
                'errors' => [],
            ], 422);
        }

        $outcome = $validated['outcome'];
        $notes = $validated['resolution_notes'];

        try {
            $restoredTo = DB::transaction(function () use ($report, $proposal, $user, $outcome, $notes) {
                $report->update([
                    'status' => 'reviewed',
                    'outcome' => $outcome,
                    'reviewed_by' => $user->id,
                    'reviewed_at' => now(),
                    'resolution_notes' => $notes,
                ]);

                if ($outcome === self::OUTCOME_APPROVAL_STANDS) {
                    return $proposal->status === 'validated'
                        ? $this->approvalReports->restoreProposal($report, $proposal, $user, "Mistaken-approval report reviewed — approval stands. {$notes}")
                        : null;
                }

                $rejectionReason = $this->rejectionReason($report, $user, $notes);
                DB::table('proposals')->where('id', $proposal->id)
                    ->update(['rejection_reason' => $rejectionReason, 'rejected_at' => now()]);

                $this->workflowService->transition(
                    $proposal->fresh(),
                    $proposal->status === 'validated' ? 'reject' : 'fail_blind_review',
                    $user,
                    $rejectionReason,
                    ['approval_report_id' => $report->id]
                );

                return null;
            });
        } catch (\Exception $e) {
            Log::error("Failed to resolve approval report {$id}: {$e->getMessage()}");

            return response()->json([
                'data' => null,
                'message' => 'The report could not be resolved — the proposal status could not be updated. Please contact an administrator.',
                'errors' => [],
            ], 422);
        }

        // Approval stands and the proposal is back in blind review: if every reviewer
        // already submitted while it was held, decide it now like any other.
        $this->approvalReports->continueFrom($proposal, $restoredTo);

        $finalStatus = $proposal->fresh()->status;

        AuditLogger::log('proposal.approval_report_resolved', Proposal::class, $proposal->id, $user->id, ['report_status' => 'open'], [
            'outcome' => $outcome,
            'notes' => $notes,
            'restored_to' => $restoredTo,
            'final_status' => $finalStatus,
        ]);

        $this->notifyReporterOfOutcome($report, $proposal, $user, $outcome, $notes, $finalStatus);

        return response()->json([
            'data' => $report->fresh(['reportedBy:id,name', 'reviewedBy:id,name']),
            'message' => $outcome === self::OUTCOME_APPROVAL_STANDS
                ? 'Approval stands. The proposal is now at '.Proposal::statusLabel($finalStatus).'.'
                : 'Mistaken approval confirmed. The proposal has been rejected and the proposal team notified.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** What the PI and co-investigators are told: both officers' notes. */
    private function rejectionReason(ProposalApprovalReport $report, User $decidedBy, string $notes): string
    {
        $reporter = $report->reportedBy?->name ?? 'the college officer';

        return 'This proposal was rejected after a review found that it had been approved by mistake. '
            ."Reported by {$reporter} (College Officer): {$report->summary} "
            ."Decision by {$decidedBy->name}: {$notes}";
    }

    private function notifyReporterOfOutcome(ProposalApprovalReport $report, Proposal $proposal, User $decidedBy, string $outcome, string $notes, string $finalStatus): void
    {
        $reporter = $report->reportedBy;
        if (! $reporter) {
            return;
        }

        $data = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'outcome' => $outcome,
            'message' => $outcome === self::OUTCOME_APPROVAL_STANDS
                ? "{$decidedBy->name} reviewed your report on {$proposal->tracker_number}: the approval stands and the proposal continues at ".Proposal::statusLabel($finalStatus).". Note: {$notes}"
                : "{$decidedBy->name} confirmed your report on {$proposal->tracker_number}: the proposal has been rejected and the proposal team notified. Note: {$notes}",
        ];

        try {
            StoreInAppNotificationJob::dispatchSync($reporter->id, 'approval_report_resolved', $data);
        } catch (\Exception $e) {
            Log::error("Approval report outcome in-app notify failed: {$e->getMessage()}");
        }

        try {
            SendEmailNotificationJob::deliver($reporter, 'approval_report_resolved', $data);
        } catch (\Exception $e) {
            Log::error("Approval report outcome email notify failed: {$e->getMessage()}");
        }
    }

    private function notifyWithdrawn(Proposal $proposal, User $reporter): void
    {
        $role = self::CATEGORY_ROLE_MAP[$proposal->category] ?? null;
        $officers = User::role(array_values(array_filter(['central_officer', $role])))->where('status', 'active')->get();

        $data = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'message' => "{$reporter->name} (college officer) cancelled their mistaken-approval report for {$proposal->tracker_number} — \"{$proposal->title}\". No action is needed.",
        ];

        foreach ($officers as $officer) {
            try {
                StoreInAppNotificationJob::dispatchSync($officer->id, 'approval_report_withdrawn', $data);
            } catch (\Exception $e) {
                Log::error("Approval report withdrawal notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyReviewers(Proposal $proposal, User $reporter, ProposalApprovalReport $report): void
    {
        $role = self::CATEGORY_ROLE_MAP[$proposal->category] ?? null;
        $roles = array_values(array_filter(['central_officer', $role]));

        $officers = User::role($roles)->where('status', 'active')->get();

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'reporter_name' => $reporter->name,
            'issue' => $report->issue_label,
            'reason' => $report->reason,
            'message' => "{$reporter->name} (college officer) flagged {$proposal->tracker_number} — \"{$proposal->title}\" as possibly mistakenly approved, currently at ".Proposal::statusLabel($proposal->status).". Issue: {$report->summary}",
        ];

        // In-app first and separately, so a mail failure can't also swallow the bell notification.
        foreach ($officers as $officer) {
            try {
                StoreInAppNotificationJob::dispatchSync($officer->id, 'approval_report_submitted', $data);
            } catch (\Exception $e) {
                Log::error("Approval report in-app notify failed: {$e->getMessage()}");
            }

            try {
                SendEmailNotificationJob::deliver($officer, 'approval_report_submitted', $data);
            } catch (\Exception $e) {
                Log::error("Approval report email notify failed: {$e->getMessage()}");
            }
        }
    }

    /**
     * The reporting college officer may raise a proposal again after the approval was
     * upheld — while it is still at a reportable stage, in their college, and nothing
     * newer has been filed about it.
     */
    private function canReportAgain(ProposalApprovalReport $report, User $user): bool
    {
        $proposal = $report->proposal;

        if ($report->status !== 'reviewed'
            || $report->outcome !== self::OUTCOME_APPROVAL_STANDS
            || ! $user->hasRole('college_officer')
            || ! $proposal
            || $proposal->college_id !== $user->college_id
            || ! in_array($proposal->status, self::REPORTABLE_STATUSES, true)) {
            return false;
        }

        return ! ProposalApprovalReport::where('proposal_id', $proposal->id)
            ->where('id', '!=', $report->id)
            ->where(fn ($q) => $q->where('status', 'open')->orWhere('created_at', '>=', $report->created_at))
            ->exists();
    }
}
