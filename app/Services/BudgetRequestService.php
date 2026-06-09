<?php

namespace App\Services;

use App\Exceptions\PreviousSettlementPendingException;
use App\Exceptions\UnsignedMembersException;
use App\Models\BudgetAllocation;
use App\Models\BudgetRequest;
use App\Models\FormSignature;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\ProposalMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BudgetRequestService
{
    /**
     * Create a new budget request for a funded proposal.
     *
     * RULE: Cannot create if any previous settlement for this proposal
     * is not finance_verified.
     *
     * @param  array  $items  Array of {category, description, amount, justification}
     * @throws PreviousSettlementPendingException
     * @throws \Exception if proposal not funded
     */
    public function create(
        Proposal $proposal,
        string $templateId,
        array $items,
        User $pi
    ): BudgetRequest {
        if (! in_array($proposal->status, ['funded', 'midterm_evaluation'])) {
            throw new \Exception(
                "Proposal must be funded to create a budget request. Current: {$proposal->status}"
            );
        }

        // Budget allocation must be approved before PI can submit a request
        $hasApprovedAllocation = BudgetAllocation::where('proposal_id', $proposal->id)
            ->where('allocation_type', 'proposal')
            ->where('status', 'approved')
            ->exists();

        if (! $hasApprovedAllocation) {
            throw new \Exception(
                'Budget request cannot be created. The budget allocation for this proposal has not been approved yet. '.
                'A college or research officer must approve the allocation first.'
            );
        }

        $completedRounds = BudgetRequest::where('proposal_id', $proposal->id)->count();
        $isFirstRound    = $completedRounds === 0;

        // Round 2+: previous settlement must be finance_verified
        if (! $isFirstRound) {
            $unsettledRound = DB::table('budget_settlements')
                ->join('budget_requests', 'budget_settlements.budget_request_id', '=', 'budget_requests.id')
                ->where('budget_requests.proposal_id', $proposal->id)
                ->where('budget_settlements.status', '!=', 'finance_verified')
                ->value('budget_requests.funding_round');

            if ($unsettledRound !== null) {
                throw new PreviousSettlementPendingException(
                    "Cannot create new budget request. Round {$unsettledRound} settlement is not yet Finance-verified."
                );
            }

            // Round 2+: must have a passed midterm evaluation (recommendation = continue)
            $passedMidterm = MidtermEvaluation::where('proposal_id', $proposal->id)
                ->where('recommendation', 'continue')
                ->exists();

            if (! $passedMidterm) {
                throw new \Exception(
                    'Cannot create a new budget round. This proposal has not passed a midterm evaluation. '.
                    'A College Officer must complete and score the midterm evaluation with a "Continue" recommendation.'
                );
            }
        }

        $totalAmount = (float) collect($items)->sum('amount');

        // Round 1: capped at 50% of awarded budget
        if ($isFirstRound) {
            $awardedAmount = (float) DB::table('awards')
                ->where('proposal_id', $proposal->id)
                ->value('awarded_amount');

            if ($awardedAmount > 0) {
                $cap = $awardedAmount * 0.5;
                if ($totalAmount > $cap) {
                    throw new \Exception(
                        sprintf(
                            'Round 1 is limited to 50%% of the awarded budget (max ETB %s). Requested: ETB %s.',
                            number_format($cap, 2),
                            number_format($totalAmount, 2)
                        )
                    );
                }
            }
        }

        // All rounds: must not exceed remaining budget (award − finalized settlements)
        $this->assertWithinRemainingBudget($proposal->id, $totalAmount);

        return DB::transaction(function () use ($proposal, $templateId, $items, $pi, $totalAmount) {
            $fundingRound = BudgetRequest::where('proposal_id', $proposal->id)->count() + 1;

            $request = BudgetRequest::create([
                'proposal_id'      => $proposal->id,
                'form_template_id' => $templateId,
                'requested_by'     => $pi->id,
                'total_amount'     => $totalAmount,
                'status'           => 'draft',
                'funding_round'    => $fundingRound,
            ]);

            foreach ($items as $item) {
                DB::table('budget_request_items')->insert([
                    'id'                => Str::uuid()->toString(),
                    'budget_request_id' => $request->id,
                    'category'          => $item['category'],
                    'description'       => $item['description'],
                    'amount'            => $item['amount'],
                    'justification'     => $item['justification'] ?? null,
                    'created_at'        => now(),
                    'updated_at'        => now(),
                ]);
            }

            $members = ProposalMember::where('proposal_id', $proposal->id)
                ->where('status', 'active')
                ->get();

            foreach ($members as $member) {
                FormSignature::create([
                    'budget_request_id' => $request->id,
                    'user_id'           => $member->user_id,
                    'role'              => $member->role === 'pi' ? 'pi' : 'co_investigator',
                    'status'            => 'pending',
                ]);
            }

            return $request->fresh();
        });
    }

    /**
     * @throws \Exception if requested amount exceeds the award minus finalized settlements
     */
    public function assertWithinRemainingBudget(string $proposalId, float $requestedAmount): void
    {
        $awardedAmount = (float) DB::table('awards')
            ->where('proposal_id', $proposalId)
            ->value('awarded_amount');

        if ($awardedAmount <= 0) {
            return; // no award recorded yet — let it through, service guards elsewhere
        }

        $totalSpent = (float) DB::table('budget_settlements')
            ->join('budget_requests', 'budget_settlements.budget_request_id', '=', 'budget_requests.id')
            ->where('budget_requests.proposal_id', $proposalId)
            ->where('budget_settlements.status', 'finance_verified')
            ->sum('budget_settlements.total_spent');

        $remaining = $awardedAmount - $totalSpent;

        if ($requestedAmount > $remaining) {
            throw new \Exception(
                sprintf(
                    'Requested amount (ETB %s) exceeds remaining budget (ETB %s). Total awarded: ETB %s, already used: ETB %s.',
                    number_format($requestedAmount, 2),
                    number_format($remaining, 2),
                    number_format($awardedAmount, 2),
                    number_format($totalSpent, 2)
                )
            );
        }
    }

    /**
     * Submit a budget request for college approval.
     *
     * RULE: ALL form_signatures must have status=signed.
     *
     * @throws UnsignedMembersException
     */
    public function submit(BudgetRequest $request, User $_pi): BudgetRequest
    {
        $unsignedSignatures = FormSignature::where('budget_request_id', $request->id)
            ->where('status', '!=', 'signed')
            ->with('user')
            ->get();

        if ($unsignedSignatures->isNotEmpty()) {
            $unsignedNames = $unsignedSignatures
                ->map(fn ($s) => $s->user->name.' ('.$s->status.')')
                ->toArray();

            throw new UnsignedMembersException(
                'Cannot submit. The following members have not signed: '.implode(', ', $unsignedNames)
            );
        }

        $request->update([
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);

        return $request->fresh();
    }
}
