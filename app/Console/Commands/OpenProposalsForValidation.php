<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\WorkflowService;
use Illuminate\Console\Command;

class OpenProposalsForValidation extends Command
{
    protected $signature   = 'rtt:open-for-validation';
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
