<?php

namespace App\Services;

use App\Models\Award;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AwardService
{
    public function __construct(private readonly WorkflowService $workflowService) {}

    /**
     * Generate award documents for an accepted proposal and transition to funded.
     *
     * @throws \Exception if proposal not in accepted state
     */
    public function generate(Proposal $proposal, User $approvedBy, float $awardedAmount): Award
    {
        if ($proposal->status !== 'accepted') {
            throw new \Exception(
                "Proposal must be in accepted state to generate award. Current: {$proposal->status}"
            );
        }

        return DB::transaction(function () use ($proposal, $approvedBy, $awardedAmount) {
            $grantReference = $this->generateGrantReference();

            $award = Award::create([
                'proposal_id' => $proposal->id,
                'grant_reference' => $grantReference,
                'approval_notes' => "Award approved by {$approvedBy->name} on ".now()->toDateString(),
                'approved_by' => $approvedBy->id,
                'approved_at' => now(),
                'awarded_amount' => $awardedAmount,
            ]);

            $this->workflowService->transition(
                $proposal,
                'fund',
                $approvedBy,
                "Proposal funded. Grant reference: {$grantReference}. Amount: {$awardedAmount}",
                ['grant_reference' => $grantReference, 'amount' => $awardedAmount]
            );

            return $award->fresh();
        });
    }

    /**
     * Create an award record for a proposal that is already in funded state.
     * Used by the central_approve flow where the transition happens before award creation.
     */
    public function createForFundedProposal(
        Proposal $proposal,
        User $approvedBy,
        float $amount = 0,
        ?string $notes = null,
        ?string $grantReference = null,
        ?\DateTimeInterface $approvedAt = null,
    ): Award {
        return DB::transaction(function () use ($proposal, $approvedBy, $amount, $notes, $grantReference, $approvedAt) {
            return Award::create([
                'proposal_id' => $proposal->id,
                'grant_reference' => $grantReference ?? $this->generateGrantReference(),
                'approval_notes' => $notes ?? "Award approved by {$approvedBy->name} on ".now()->toDateString(),
                'approved_by' => $approvedBy->id,
                'approved_at' => $approvedAt ?? now(),
                'awarded_amount' => $amount,
            ]);
        });
    }

    /**
     * Generate a sequential grant reference: GRANT-YYYY-000001
     */
    private function generateGrantReference(): string
    {
        $year = now()->year;

        $lastAward = DB::table('awards')
            ->where('grant_reference', 'like', "GRANT-{$year}-%")
            ->orderByDesc('grant_reference')
            ->lockForUpdate()
            ->first();

        $newSequence = $lastAward
            ? ((int) substr($lastAward->grant_reference, -6)) + 1
            : 1;

        return 'GRANT-'.$year.'-'.str_pad($newSequence, 6, '0', STR_PAD_LEFT);
    }
}
