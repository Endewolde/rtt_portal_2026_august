<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\ProposalApprovalReport;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * College officers can't reject a proposal out of blind review themselves (that's
 * restricted to central_officer/super_admin/category officers — see
 * ReviewController::rejectFromBlindReview) — this is how they flag a proposal they
 * believe was mistakenly approved past validation to the people who can act on it.
 */
class ProposalApprovalReportController extends Controller
{
    private const CATEGORY_ROLE_MAP = [
        'research' => 'research_officer',
        'community_engagement' => 'community_officer',
        'technology_transfer' => 'technology_officer',
    ];

    private const REPORTABLE_STATUSES = ['under_blind_review', 'blind_review_passed'];

    private const REVIEWER_ROLES = ['super_admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'];

    /** College officer flags a proposal in blind review as possibly mistakenly approved. */
    public function store(string $proposalId, Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasRole('college_officer')) {
            return response()->json(['data' => null, 'message' => 'Only college officers can report a mistaken approval.', 'errors' => []], 403);
        }

        $request->validate(['reason' => 'required|string|min:10|max:2000']);

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

        $report = ProposalApprovalReport::create([
            'proposal_id' => $proposalId,
            'reported_by' => $user->id,
            'reason' => $request->reason,
            'status' => 'open',
        ]);

        AuditLogger::log('proposal.approval_reported', Proposal::class, $proposalId, $user->id, null, [
            'tracker' => $proposal->tracker_number,
        ]);

        $this->notifyReviewers($proposal, $user, $request->reason);

        return response()->json([
            'data' => $report,
            'message' => 'Reported. Central office and the category officer have been notified.',
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

    /** Central/category officer marks a report as handled — dismissed or acted on elsewhere (e.g. rejected from blind review). */
    public function markReviewed(string $id, Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasAnyRole(self::REVIEWER_ROLES)) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $request->validate(['resolution_notes' => 'nullable|string|max:2000']);

        $report = ProposalApprovalReport::findOrFail($id);

        if ($report->status === 'reviewed') {
            return response()->json(['data' => null, 'message' => 'This report has already been marked reviewed.', 'errors' => []], 422);
        }

        $report->update([
            'status' => 'reviewed',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
            'resolution_notes' => $request->resolution_notes,
        ]);

        return response()->json(['data' => $report->fresh(), 'message' => 'Report marked reviewed.', 'errors' => [], 'meta' => []]);
    }

    private function notifyReviewers(Proposal $proposal, User $reporter, string $reason): void
    {
        $role = self::CATEGORY_ROLE_MAP[$proposal->category] ?? null;
        $roles = array_values(array_filter(['central_officer', $role]));

        $officers = User::role($roles)->where('status', 'active')->get();

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'reporter_name' => $reporter->name,
            'reason' => $reason,
            'message' => "{$reporter->name} (college officer) flagged {$proposal->tracker_number} — \"{$proposal->title}\" as possibly mistakenly approved, currently at ".str_replace('_', ' ', $proposal->status).". Reason: {$reason}",
        ];

        foreach ($officers as $officer) {
            try {
                SendEmailNotificationJob::dispatchSync($officer, 'approval_report_submitted', $data);
                StoreInAppNotificationJob::dispatchSync($officer->id, 'approval_report_submitted', $data);
            } catch (\Exception $e) {
                Log::error("Approval report notify failed: {$e->getMessage()}");
            }
        }
    }
}
