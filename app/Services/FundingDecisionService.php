<?php

namespace App\Services;

use App\Exceptions\OverBudgetException;
use App\Models\Award;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The central funding decision for one proposal — approve with an award, or reject —
 * used by the single-proposal buttons and by publishing a funding round, so both
 * behave identically.
 */
class FundingDecisionService
{
    public function __construct(
        private WorkflowService $workflow,
        private AwardService $awards,
        private FundingBudgetService $budget,
    ) {}

    /**
     * Fund a proposal. The call row is locked while the budget is checked and the
     * award written, so two people approving at once cannot spend the same money.
     *
     * @return array{0: Proposal, 1: Award}
     *
     * @throws OverBudgetException when the award is more than is left in the call's budget
     */
    public function approve(Proposal $proposal, User $actor, float $amount, ?string $remarks = null): array
    {
        return DB::transaction(function () use ($proposal, $actor, $amount, $remarks) {
            $call = $proposal->proposal_call_id ? ProposalCall::whereKey($proposal->proposal_call_id)->lockForUpdate()->first() : null;

            if ($call) {
                $summary = $this->budget->summary($call, $proposal->id);
                if ($summary['remaining'] !== null && $amount > $summary['remaining'] + 0.005) {
                    throw new OverBudgetException($summary['remaining'], round($amount - $summary['remaining'], 2));
                }

                // Once the call has a budget, a college-level decider spends only their college's share of it.
                if ($summary['budget'] !== null && $actor->accessScope()->isCollege()) {
                    $share = $this->budget->collegeSummary($call, (string) $proposal->college_id, $proposal->id);
                    if ($share['remaining'] === null) {
                        throw ValidationException::withMessages(['awarded_amount' => 'The central office has not yet allocated your college\'s share of this call\'s budget.']);
                    }
                    if ($amount > $share['remaining'] + 0.005) {
                        throw new OverBudgetException($share['remaining'], round($amount - $share['remaining'], 2), 'your college\'s share of the call\'s budget');
                    }
                }
            }

            // The award exists before the transition, so the "funded" email carries the amount.
            $existing = Award::where('proposal_id', $proposal->id)->first();
            if ($existing) {
                $existing->update([
                    'awarded_amount' => $amount,
                    'approval_notes' => $remarks ?? $existing->approval_notes,
                    'approved_by' => $actor->id,
                    'approved_at' => now(),
                ]);
                $award = $existing->fresh();
            } else {
                $award = $this->awards->createForFundedProposal($proposal, $actor, $amount, $remarks);
            }

            $updated = $this->workflow->transition($proposal, 'central_approve', $actor, $remarks ?? 'Approved by Central Office for funding');

            return [$updated, $award];
        });
    }

    /** Reject a proposal at the central stage with the (already composed) reason. */
    public function reject(Proposal $proposal, User $actor, string $reason): Proposal
    {
        return DB::transaction(function () use ($proposal, $actor, $reason) {
            DB::table('proposals')->where('id', $proposal->id)->update(['rejection_reason' => $reason, 'rejected_at' => now()]);

            return $this->workflow->transition($proposal->fresh(), 'central_reject', $actor, $reason);
        });
    }
}
