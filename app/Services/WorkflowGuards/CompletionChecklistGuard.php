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

        // If the proposal has budget requests, ensure all have an approved settlement.
        $hasPendingSettlement = $proposal->budgetRequests()
            ->whereDoesntHave('settlement', fn ($q) => $q->where('status', 'approved'))
            ->exists();

        if ($hasPendingSettlement) {
            $this->failReason = 'All budget requests must have an approved settlement before archiving.';

            return false;
        }

        return true;
    }

    public function message(): string
    {
        return $this->failReason;
    }
}
