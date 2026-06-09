<?php

namespace App\Services;

use App\Jobs\StoreInAppNotificationJob;
use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\College;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class BudgetAllocationService
{
    /**
     * Allocate a budget envelope to a college for a fiscal year (audit record only).
     *
     * @throws AuthorizationException
     */
    public function allocateToCollege(
        College $college,
        float $amount,
        string $fiscalYear,
        User $allocatedBy,
        ?string $notes = null
    ): BudgetAllocation {
        if (! $allocatedBy->can('budget_allocations.create')) {
            throw new AuthorizationException(
                'You do not have permission to allocate budgets.'
            );
        }

        return BudgetAllocation::create([
            'college_id' => $college->id,
            'proposal_id' => null,
            'fiscal_year' => $fiscalYear,
            'total_amount' => $amount,
            'allocated_amount' => 0,
            'remaining_balance' => $amount,
            'allocation_type' => 'college',
            'status' => 'approved',
            'allocated_by' => $allocatedBy->id,
            'notes' => $notes,
        ]);
    }

    /**
     * Create a pending proposal budget allocation from the proposal's awarded amount.
     * The total_amount defaults to the full awarded amount.
     *
     * @throws \Exception if proposal has no award or amount exceeds college remaining
     */
    public function allocateToProposal(
        Proposal $proposal,
        float $amount,
        string $fiscalYear,
        User $allocatedBy,
        ?string $notes = null
    ): BudgetAllocation {
        return DB::transaction(function () use ($proposal, $amount, $fiscalYear, $allocatedBy, $notes) {
            // Total budget for this college = sum of awarded amounts for funded proposals
            $totalBudget = Award::join('proposals', 'proposals.id', '=', 'awards.proposal_id')
                ->where('proposals.college_id', $proposal->college_id)
                ->whereIn('proposals.status', ['funded', 'midterm_evaluation', 'completion', 'completed'])
                ->lockForUpdate()
                ->sum('awards.awarded_amount');

            if ($totalBudget <= 0) {
                throw new \Exception(
                    'No awarded budget found for this college. Proposals must be funded and awarded first.'
                );
            }

            $alreadyAllocated = BudgetAllocation::where('college_id', $proposal->college_id)
                ->where('allocation_type', 'proposal')
                ->lockForUpdate()
                ->sum('total_amount');

            $remaining = (float) $totalBudget - (float) $alreadyAllocated;

            if ($amount > $remaining) {
                throw new \Exception(
                    sprintf(
                        'Amount ETB %s exceeds college remaining balance of ETB %s.',
                        number_format($amount, 2),
                        number_format($remaining, 2)
                    )
                );
            }

            return BudgetAllocation::create([
                'college_id' => $proposal->college_id,
                'proposal_id' => $proposal->id,
                'fiscal_year' => $fiscalYear,
                'total_amount' => $amount,
                'allocated_amount' => 0,
                'remaining_balance' => $amount,
                'allocation_type' => 'proposal',
                'status' => 'pending',
                'allocated_by' => $allocatedBy->id,
                'notes' => $notes,
            ]);
        });
    }

    /**
     * One-click allocate from the proposal's full awarded amount (creates pending allocation).
     *
     * @throws \Exception if no award exists or allocation already exists
     */
    public function quickAllocateFromAward(Proposal $proposal, User $allocatedBy, string $fiscalYear): BudgetAllocation
    {
        $existing = BudgetAllocation::where('proposal_id', $proposal->id)
            ->where('allocation_type', 'proposal')
            ->first();

        if ($existing) {
            throw new \Exception('A budget allocation already exists for this proposal.');
        }

        $awardedAmount = (float) Award::where('proposal_id', $proposal->id)->value('awarded_amount');

        if ($awardedAmount <= 0) {
            throw new \Exception('No award found for this proposal. Award it before allocating a budget.');
        }

        return $this->allocateToProposal($proposal, $awardedAmount, $fiscalYear, $allocatedBy);
    }

    /**
     * Approve a single pending budget allocation.
     *
     * @throws \Exception if not pending
     */
    public function approve(BudgetAllocation $allocation, User $approvedBy): BudgetAllocation
    {
        if ($allocation->status === 'approved') {
            throw new \Exception('This allocation is already approved.');
        }

        $allocation->update([
            'status' => 'approved',
            'approved_by' => $approvedBy->id,
            'approved_at' => now(),
        ]);

        $fresh = $allocation->fresh()->load('proposal.pi');
        $this->notifyAllocationApproved($fresh);

        return $fresh;
    }

    private function notifyAllocationApproved(BudgetAllocation $allocation): void
    {
        $proposal = $allocation->proposal;
        $pi = $proposal?->pi;

        if (! $pi || ! $pi->email) {
            return;
        }

        app(MailConfigService::class)->applyFromDatabase();

        $data = [
            'title' => $proposal->title,
            'tracker_number' => $proposal->tracker_number,
            'allocated_amount' => $allocation->total_amount ?? $allocation->allocated_amount ?? null,
            'fiscal_year' => $allocation->fiscal_year ?? null,
        ];

        try {
            Mail::html(
                view('emails.notifications.budget_allocated', array_merge($data, ['recipient' => $pi]))->render(),
                fn ($msg) => $msg->to($pi->email, $pi->name)
                    ->subject("Budget Allocated — {$proposal->tracker_number}")
            );
        } catch (\Exception $e) {
            Log::error("Budget allocation email failed for {$pi->email}: ".$e->getMessage());
        }

        try {
            StoreInAppNotificationJob::dispatchSync($pi->id, 'budget_allocated', $data);
        } catch (\Exception) {
            // Non-critical
        }
    }

    /**
     * Bulk approve multiple pending allocations by their IDs.
     *
     * @param  string[]  $ids
     * @return int number actually approved
     */
    public function bulkApprove(array $ids, User $approvedBy): int
    {
        return BudgetAllocation::whereIn('id', $ids)
            ->where('allocation_type', 'proposal')
            ->where('status', 'pending')
            ->update([
                'status' => 'approved',
                'approved_by' => $approvedBy->id,
                'approved_at' => now(),
            ]);
    }

    /**
     * Update amount and/or notes on a pending allocation.
     * Recalculates remaining_balance.
     *
     * @throws \Exception if allocation is already approved
     */
    public function updateAllocation(BudgetAllocation $allocation, float $amount, ?string $notes): BudgetAllocation
    {
        if ($allocation->status === 'approved') {
            // Still allow note-only updates on approved allocations
            $allocation->update(['notes' => $notes]);

            return $allocation->fresh();
        }

        $allocation->update([
            'total_amount' => $amount,
            'remaining_balance' => $amount,
            'notes' => $notes,
        ]);

        return $allocation->fresh();
    }
}
