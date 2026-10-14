<?php

namespace App\Listeners;

use App\Events\ProposalTransitioned;
use App\Services\AnonymityCheckService;
use Illuminate\Support\Facades\Log;

/** Check every (re)submitted proposal for identifying details before validation. */
class RunAnonymityCheckOnSubmission
{
    public function __construct(private readonly AnonymityCheckService $anonymity) {}

    public function handle(ProposalTransitioned $event): void
    {
        if ($event->toStage !== 'submitted') {
            return;
        }

        try {
            $this->anonymity->check($event->proposal);
        } catch (\Throwable $e) {
            // A failed check must never block a submission — it can be re-run.
            Log::error("Anonymity check failed for proposal {$event->proposal->id}: {$e->getMessage()}");
        }
    }
}
