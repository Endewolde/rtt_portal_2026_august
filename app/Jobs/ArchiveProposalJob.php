<?php

namespace App\Jobs;

use App\Models\Proposal;
use App\Models\User;
use App\Services\WorkflowService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ArchiveProposalJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    public function __construct(public string $proposalId)
    {
        $this->onQueue('default');
    }

    public function handle(WorkflowService $workflowService): void
    {
        $proposal = Proposal::find($this->proposalId);

        if (! $proposal) {
            Log::warning("ArchiveProposalJob: proposal {$this->proposalId} not found.");

            return;
        }

        if ($proposal->status !== 'completed') {
            Log::info("ArchiveProposalJob: proposal {$this->proposalId} not in completed state. Skipping.");

            return;
        }

        $systemActor = User::role('super_admin')->first()
            ?? User::role('central_officer')->first();

        if (! $systemActor) {
            Log::error('ArchiveProposalJob: no system actor found.');

            return;
        }

        $workflowService->transition(
            $proposal,
            'archive',
            $systemActor,
            'Automatic archival 30 days after completion'
        );

        Log::info("ArchiveProposalJob: proposal {$this->proposalId} archived successfully.");
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("ArchiveProposalJob permanently failed for {$this->proposalId}", [
            'error' => $exception->getMessage(),
        ]);
    }
}
