<?php

namespace App\Jobs;

use App\Models\Proposal;
use App\Services\SimilarityService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckProposalSimilarityJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    public function __construct(public string $proposalId)
    {
        $this->onQueue('similarity');
    }

    public function handle(SimilarityService $service): void
    {
        $proposal = Proposal::find($this->proposalId);

        if (! $proposal) {
            Log::warning("CheckProposalSimilarityJob: proposal {$this->proposalId} not found.");

            return;
        }

        $service->check($proposal);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("Similarity check job failed for proposal {$this->proposalId}", [
            'error' => $exception->getMessage(),
        ]);
    }
}
