<?php

namespace App\Services;

use App\Exceptions\ConflictingReviewerException;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ReviewAssignmentService
{
    public function __construct(private readonly WorkflowService $workflowService) {}

    /**
     * Assign reviewers to a proposal.
     * CRITICAL: Detects and blocks conflicting reviewers (proposal members).
     *
     * When $proposal->status is 'validated', also transitions to under_blind_review.
     * When $proposal->status is 'blind_review_passed', only creates assignment records
     * (DefenceSessionService handles its own workflow transition).
     *
     * @param  array  $reviewerIds
     * @return ReviewAssignment[]
     *
     * @throws ConflictingReviewerException if any reviewer is an active proposal member
     * @throws \Exception if proposal is not in a valid state for assignment
     */
    public function assign(
        Proposal $proposal,
        array $reviewerIds,
        string $evaluationTypeId,
        User $assignedBy
    ): array {
        $validStates = ['validated', 'blind_review_passed'];

        if (! in_array($proposal->status, $validStates)) {
            throw new \Exception(
                "Proposal must be in validated or blind_review_passed state to assign reviewers. Current: {$proposal->status}"
            );
        }

        $memberUserIds = DB::table('proposal_members')
            ->where('proposal_id', $proposal->id)
            ->where('status', 'active')
            ->pluck('user_id')
            ->toArray();

        $conflicted = array_intersect($reviewerIds, $memberUserIds);

        if (! empty($conflicted)) {
            $names = User::whereIn('id', $conflicted)->pluck('name')->toArray();
            throw new ConflictingReviewerException(
                'The following users cannot review this proposal as they are team members: '
                .implode(', ', $names)
            );
        }

        $assignments = [];

        DB::transaction(function () use ($proposal, $reviewerIds, $evaluationTypeId, $assignedBy, &$assignments) {
            foreach ($reviewerIds as $reviewerId) {
                $assignments[] = ReviewAssignment::create([
                    'proposal_id'        => $proposal->id,
                    'reviewer_id'        => $reviewerId,
                    'evaluation_type_id' => $evaluationTypeId,
                    'assigned_by'        => $assignedBy->id,
                    'status'             => 'pending',
                    'assigned_at'        => now(),
                    'due_date'           => now()->addDays(14)->toDateString(),
                ]);
            }

            // Only transition for blind review assignment from validated state
            if ($proposal->status === 'validated') {
                $this->workflowService->transition(
                    $proposal,
                    'assign_for_review',
                    $assignedBy,
                    'Assigned '.count($reviewerIds).' reviewer(s) for blind review'
                );
            }
        });

        return $assignments;
    }

    /**
     * Get all active users (any role except guest) who are NOT members of this proposal.
     * Any user with at least the staff role can be assigned as a reviewer,
     * irrespective of college or department.
     */
    public function getAvailableReviewers(string $proposalId): \Illuminate\Support\Collection
    {
        $memberUserIds = DB::table('proposal_members')
            ->where('proposal_id', $proposalId)
            ->where('status', 'active')
            ->pluck('user_id');

        return User::whereHas('roles', fn ($q) => $q->where('name', '!=', 'staff'))
            ->whereNotIn('id', $memberUserIds)
            ->where('status', 'active')
            ->with('roles:name')
            ->get(['id', 'name', 'email', 'college_id', 'department_id']);
    }
}
