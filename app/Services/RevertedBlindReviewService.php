<?php

namespace App\Services;

use App\Events\ProposalTransitioned;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/**
 * Proposals sent back to "validated" although a blind reviewer had already submitted.
 *
 * Until 2026-10-15, removing a blind reviewer reverted the proposal to validated whenever
 * nobody was still working on it — ignoring reviewers who had already submitted — and the
 * one-off reviews:revert-empty-blind-review command had the same gap. The finished review
 * was never decided (that only happens under blind review), so these proposals sit at
 * validated with a real result that never moved them on.
 */
class RevertedBlindReviewService
{
    public function __construct(
        private WorkflowService $workflowService,
        private ReviewScoreService $scoreService,
    ) {}

    /**
     * Validated proposals whose latest step was a reviewer revert, that hold a submitted
     * blind review and have nobody still reviewing.
     *
     * @param  (callable(Builder<Proposal>): mixed)|null  $scope  narrows the search, e.g. to an officer's college
     * @return Collection<int, Proposal>
     */
    public function stuck(?callable $scope = null): Collection
    {
        $blind = fn ($q) => $q->where('name', 'like', 'blind_review%');

        return Proposal::query()
            ->when($scope, fn ($q) => $scope($q))
            ->where('status', 'validated')
            ->whereHas('reviewAssignments', fn ($q) => $q->where('status', 'submitted')->whereHas('evaluationType', $blind))
            ->whereDoesntHave('reviewAssignments', fn ($q) => $q->whereIn('status', ['pending', 'accepted', 'in_progress'])->whereHas('evaluationType', $blind))
            ->orderBy('tracker_number')
            ->get()
            ->filter(fn (Proposal $p) => DB::table('workflow_logs')
                ->where('proposal_id', $p->id)
                ->where('to_stage', 'validated')
                ->orderByDesc('created_at')
                ->value('action') === 'unassign_reviewers')
            ->values();
    }

    /**
     * What restoring would lead to, without changing anything.
     *
     * @return array{outcome: string, submitted: int, required: ?int, score_label: ?string, threshold: ?float}
     */
    public function predict(Proposal $proposal): array
    {
        return $this->scoreService->predictBlindReviewOutcome($proposal);
    }

    /**
     * Put the proposal back under blind review and let the normal decision run on the
     * reviews already submitted. The return to blind review is a correction, not a new
     * phase, so the PI isn't told they have "entered blind review"; the decision that
     * follows (pass, or a flag for officers) notifies as usual.
     */
    public function restore(Proposal $proposal, User $actor): Proposal
    {
        Event::fakeFor(fn () => $this->workflowService->transition(
            $proposal,
            'assign_for_review',
            $actor,
            'Returned to blind review — a submitted review had been left undecided when another reviewer was removed (data correction).',
            ['correction' => 'reverted_blind_review'],
        ), [ProposalTransitioned::class]);

        $this->scoreService->processBlindReviewResult($proposal->fresh());

        return $proposal->fresh();
    }
}
