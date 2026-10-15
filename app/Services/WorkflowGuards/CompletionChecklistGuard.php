<?php

namespace App\Services\WorkflowGuards;

use App\Models\Proposal;
use App\Models\User;

class CompletionChecklistGuard
{
    private string $failReason = '';

    public function check(Proposal $proposal, User $actor): bool
    {
        $hasOutput = $proposal->researchOutputs()->exists();

        if (! $hasOutput) {
            $this->failReason = 'At least one research output must be recorded before archiving.';

            return false;
        }

        // Every released budget must be fully settled (finance-verified is the final settlement step).
        $hasPendingSettlement = $proposal->budgetRequests()
            ->where('status', 'disbursed')
            ->whereDoesntHave('settlement', fn ($q) => $q->where('status', 'finance_verified'))
            ->exists();

        if ($hasPendingSettlement) {
            $this->failReason = 'All released funds must be settled and verified by finance before archiving.';

            return false;
        }

        return true;
    }

    public function message(): string
    {
        return $this->failReason;
    }
}
