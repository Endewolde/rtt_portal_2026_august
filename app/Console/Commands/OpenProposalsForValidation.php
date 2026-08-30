<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\WorkflowService;
use Illuminate\Console\Command;

/**
 * NOT scheduled (see bootstrap/app.php withSchedule()) — the query below filters
 * on Proposal.status = 'pending_validation' and transitions via a workflow action
 * named 'open_for_validation', but neither exists anywhere else in the app: real
 * proposals go straight from 'submitted' into the validation queue
 * (ProposalValidationService::getValidationQueue() already filters on 'submitted'
 * directly, no separate "opening" step). So the loop below never finds a matching
 * proposal and this command's only real effect was closing expired calls — which
 * duplicated and raced against rtt:expire-calls on the same rows when both were
 * scheduled. Left in place in case the validation-queue-opening idea gets revived
 * properly (with a real status/action), but don't re-add it to the scheduler as-is.
 */
class OpenProposalsForValidation extends Command
{
    protected $signature = 'rtt:open-for-validation';

    protected $description = 'Close expired calls and surface their proposals in the validation queue';

    public function handle(WorkflowService $workflowService): void
    {
        $expiredCalls = ProposalCall::where('end_date', '<', now()->toDateString())
            ->where('status', 'active')
            ->get();

        if ($expiredCalls->isEmpty()) {
            $this->info('No expired calls found.');

            return;
        }

        $systemActor = User::role('super_admin')->first();

        foreach ($expiredCalls as $call) {
            $call->update(['status' => 'closed', 'is_open' => false]);
            $this->info("Closed call: {$call->title}");

            $proposals = Proposal::where('proposal_call_id', $call->id)
                ->where('status', 'pending_validation')
                ->get();

            foreach ($proposals as $proposal) {
                try {
                    $workflowService->transition(
                        $proposal,
                        'open_for_validation',
                        $systemActor,
                        'Automatically opened for validation after call deadline'
                    );
                    $this->info("Opened for validation: {$proposal->tracker_number}");
                } catch (\Exception $e) {
                    $this->error("Failed for {$proposal->tracker_number}: {$e->getMessage()}");
                }
            }
        }
    }
}
