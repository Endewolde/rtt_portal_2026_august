<?php

namespace App\Services;

use App\Exceptions\ConflictingReviewerException;
use App\Exceptions\ReviewerOverloadedException;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\ThresholdSetting;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ReviewAssignmentService
{
    public function __construct(
        private readonly WorkflowService $workflowService,
        private readonly MailConfigService $mailConfig
    ) {}

    /**
     * Assign reviewers to a proposal.
     * CRITICAL: Detects and blocks conflicting reviewers (proposal members).
     *
     * When $proposal->status is 'validated', also transitions to under_blind_review.
     * When $proposal->status is 'blind_review_passed', only creates assignment records
     * (DefenceSessionService handles its own workflow transition).
     *
     * @return ReviewAssignment[]
     *
     * @throws ConflictingReviewerException if any reviewer is an active proposal member
     * @throws \Exception if proposal is not in a valid state for assignment
     */
    /**
     * @param  array{venue?: string, scheduled_date?: string, scheduled_time?: string}  $sessionData
     *                                                                                                Extra context for open-defence assignments (venue, date, time).
     */
    public function assign(
        Proposal $proposal,
        array $reviewerIds,
        string $evaluationTypeId,
        User $assignedBy,
        array $sessionData = [],
        ?string $dueDate = null,
        bool $overrideWorkloadCap = false
    ): array {
        // under_open_defence: adding reviewers to a defence that is already scheduled.
        $validStates = ['validated', 'blind_review_passed', 'under_open_defence'];

        if (! in_array($proposal->status, $validStates)) {
            throw new \Exception(
                "Proposal must be validated, past blind review, or in open defence to assign reviewers. Current: {$proposal->status}"
            );
        }

        $inactiveReviewers = User::whereIn('id', $reviewerIds)
            ->where('status', '!=', 'active')
            ->pluck('name')
            ->toArray();

        if (! empty($inactiveReviewers)) {
            throw new \InvalidArgumentException(
                'The following users have inactive accounts and cannot be assigned as reviewers: '
                .implode(', ', $inactiveReviewers)
            );
        }

        $memberUserIds = DB::table('proposal_members')
            ->where('proposal_id', $proposal->id)
            ->where('status', 'active')
            ->pluck('user_id')
            ->push($proposal->pi_user_id)
            ->unique()
            ->values()
            ->toArray();

        $conflicted = array_intersect($reviewerIds, $memberUserIds);

        if (! empty($conflicted)) {
            $names = User::whereIn('id', $conflicted)->pluck('name')->toArray();
            throw new ConflictingReviewerException(
                'The following users are Principal Investigators or team members and cannot review this proposal: '
                .implode(', ', $names)
            );
        }

        $this->ensureWithinWorkloadCap($reviewerIds, $overrideWorkloadCap);

        $assignments = [];

        $dueDate = $dueDate ?? now()->addDays(14)->toDateString();

        // Captured BEFORE the transition below — WorkflowService::transition() mutates
        // $proposal->status in place (validated -> under_blind_review), so reading it
        // again afterwards always looks like "not validated" and mislabels every blind
        // review assignment email/notification as "Open Defence".
        $reviewType = $proposal->status === 'validated' ? 'Blind Review' : 'Open Defence';

        DB::transaction(function () use ($proposal, $reviewerIds, $evaluationTypeId, $assignedBy, $dueDate, &$assignments) {
            foreach ($reviewerIds as $reviewerId) {
                $assignments[] = ReviewAssignment::create([
                    'proposal_id' => $proposal->id,
                    'reviewer_id' => $reviewerId,
                    'evaluation_type_id' => $evaluationTypeId,
                    'assigned_by' => $assignedBy->id,
                    'status' => 'pending',
                    'assigned_at' => now(),
                    'due_date' => $dueDate,
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

        // Notify each reviewer after the transaction commits
        $reviewers = User::whereIn('id', $reviewerIds)->get();

        foreach ($reviewers as $reviewer) {
            $this->notifyReviewer($reviewer, $proposal, $reviewType, $dueDate, $sessionData);
        }

        return $assignments;
    }

    /**
     * Block assignment of reviewers already at or above the configured max concurrent
     * active reviews, unless explicitly overridden by the assigning admin.
     *
     * @throws ReviewerOverloadedException
     */
    public function ensureWithinWorkloadCap(array $reviewerIds, bool $override = false): void
    {
        if ($override || empty($reviewerIds)) {
            return;
        }

        $cap = (int) (ThresholdSetting::where('key', 'max_reviewer_active_assignments')->value('value') ?? 5);

        $overloaded = User::whereIn('id', $reviewerIds)
            ->withCount([
                'reviewAssignments as active_assignments' => fn ($q) => $q->whereIn('status', ['pending', 'accepted', 'in_progress']),
            ])
            ->get(['id', 'name'])
            ->filter(fn (User $u) => $u->active_assignments >= $cap);

        if ($overloaded->isNotEmpty()) {
            $names = $overloaded->map(fn (User $u) => "{$u->name} ({$u->active_assignments} active)")->implode(', ');
            throw new ReviewerOverloadedException(
                "These reviewers are at or above the max workload of {$cap} active reviews: {$names}."
            );
        }
    }

    /**
     * Get eligible reviewers for a proposal, excluding the PI, co-investigators, and
     * all active team members. Supports filtering by name/email/expertise, department,
     * and college. Includes active assignment count for workload balancing.
     *
     * @param  array{search?: string, expertise?: string, department_id?: string, college_id?: string, reviewer_type?: string}  $filters
     */
    public function getAvailableReviewers(string $proposalId, array $filters = []): Collection
    {
        $proposal = Proposal::findOrFail($proposalId);

        // Exclude PI and all active proposal members (co-investigators included)
        $excludedIds = DB::table('proposal_members')
            ->where('proposal_id', $proposalId)
            ->where('status', 'active')
            ->pluck('user_id')
            ->push($proposal->pi_user_id)
            ->unique()
            ->values();

        // Eligible reviewers: active staff or external reviewers, excluding the proposal's own PI/team.
        $query = User::whereHas('roles', fn ($q) => $q->whereIn('name', ['staff', 'external_reviewer']))
            ->whereNotIn('id', $excludedIds)
            ->where('status', 'active')
            ->with(['roles:name', 'college:id,name', 'department:id,name'])
            ->withCount([
                'reviewAssignments as active_assignments' => fn ($q) => $q->whereIn('status', ['pending', 'accepted', 'in_progress']),
            ]);

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$term}%")
                ->orWhere('email', 'like', "%{$term}%")
                ->orWhereRaw("JSON_SEARCH(LOWER(expertise), 'one', ?) IS NOT NULL", ['%'.strtolower($term).'%'])
            );
        }

        if (! empty($filters['expertise'])) {
            $term = $filters['expertise'];
            $query->whereRaw("JSON_SEARCH(LOWER(expertise), 'one', ?) IS NOT NULL", ['%'.strtolower($term).'%']);
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }

        if (! empty($filters['college_id'])) {
            $query->where('college_id', $filters['college_id']);
        }

        if (($filters['reviewer_type'] ?? null) === 'external') {
            $query->whereHas('roles', fn ($q) => $q->where('name', 'external_reviewer'));
        } elseif (($filters['reviewer_type'] ?? null) === 'internal') {
            $query->whereHas('roles', fn ($q) => $q->where('name', 'staff'));
        }

        return $query
            ->orderBy('active_assignments')
            ->orderBy('name')
            ->get(['id', 'name', 'title', 'email', 'college_id', 'department_id', 'expertise']);
    }

    private function notifyReviewer(
        User $reviewer,
        Proposal $proposal,
        string $reviewType,
        string $dueDate,
        array $sessionData = []
    ): void {
        $data = [
            'tracker_number' => $proposal->tracker_number,
            'proposal_title' => $proposal->title,
            'review_type' => $reviewType,
            'due_date' => $dueDate,
            'venue' => $sessionData['venue'] ?? null,
            'scheduled_date' => $sessionData['scheduled_date'] ?? null,
            'scheduled_time' => $sessionData['scheduled_time'] ?? null,
        ];

        if ($reviewer->email) {
            try {
                $this->mailConfig->applyFromDatabase();
                $subject = "{$reviewType} Assignment — {$proposal->tracker_number}";
                Mail::html(
                    view('emails.notifications.review_assignment', array_merge($data, ['recipient' => $reviewer]))->render(),
                    fn ($msg) => $msg->to($reviewer->email, $reviewer->name)->subject($subject)
                );
            } catch (\Exception $e) {
                Log::error("Review assignment email failed for {$reviewer->email}: ".$e->getMessage());
            }
        }

        try {
            StoreInAppNotificationJob::dispatchSync($reviewer->id, 'review_assignment', $data);
        } catch (\Exception $e) {
            Log::error("In-app review assignment notification failed for {$reviewer->id}: ".$e->getMessage());
        }
    }
}
