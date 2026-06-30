<?php

namespace App\Services;

use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Models\MidtermEvaluation;
use App\Models\User;

class BudgetSettlementService
{
    /**
     * PI submits settlement documents.
     *
     * @param  array  $data  total_spent, unspent_amount, expense_report_path
     *
     * @throws \Exception
     */
    public function submitSettlement(BudgetRequest $request, User $pi, array $data): BudgetSettlement
    {
        if ($request->status !== 'disbursed') {
            throw new \Exception(
                "Budget request must be disbursed before settlement. Current: {$request->status}"
            );
        }

        return BudgetSettlement::create([
            'budget_request_id' => $request->id,
            'submitted_by' => $pi->id,
            'status' => 'submitted',
            'expense_report_path' => $data['expense_report_path'] ?? null,
            'total_spent' => $data['total_spent'],
            'unspent_amount' => $data['unspent_amount'] ?? 0,
        ]);
    }

    /**
     * College Officer verifies settlement.
     */
    public function verifySettlement(
        BudgetSettlement $settlement,
        User $collegeOfficer,
        ?string $notes
    ): BudgetSettlement {
        if ($settlement->status !== 'submitted') {
            throw new \Exception(
                'Settlement must be in submitted status before college verification. Current status: '.$settlement->status
            );
        }

        $proposalId = $settlement->budgetRequest?->proposal_id
            ?? $settlement->load('budgetRequest')->budgetRequest?->proposal_id;

        // The Mid-Term M&E meeting must have been held and scored before the
        // college officer can verify the settlement. Submitting the progress
        // report alone is not sufficient — the PI must have presented and
        // justified their budget usage during the actual evaluation session.
        $midtermScored = MidtermEvaluation::where('proposal_id', $proposalId)
            ->whereIn('status', ['scored', 'completed'])
            ->exists();

        if (! $midtermScored) {
            throw new \Exception(
                'The Mid-Term Monitoring & Evaluation meeting must be completed and scored before the college officer can verify the settlement. The PI must present and justify their budget usage during the evaluation session first.'
            );
        }

        $settlement->update([
            'status' => 'college_verified',
            'college_verified_by' => $collegeOfficer->id,
            'college_verified_at' => now(),
            'college_notes' => $notes,
        ]);

        return $settlement->fresh();
    }

    /**
     * Finance finalizes settlement. After this, PI is eligible for next round.
     *
     * @throws \Exception if settlement is not college_verified first
     */
    public function finalizeSettlement(
        BudgetSettlement $settlement,
        User $financeUser,
        ?string $notes
    ): BudgetSettlement {
        if ($settlement->status !== 'college_verified') {
            throw new \Exception(
                'Settlement must be college-verified before Finance can finalize it.'
            );
        }

        $settlement->update([
            'status' => 'finance_verified',
            'finance_verified_by' => $financeUser->id,
            'finance_verified_at' => now(),
            'finance_notes' => $notes,
        ]);

        $settlement->budgetRequest->update(['status' => 'settled']);

        return $settlement->fresh();
    }
}
