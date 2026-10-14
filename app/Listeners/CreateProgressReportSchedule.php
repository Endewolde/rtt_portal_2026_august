<?php

namespace App\Listeners;

use App\Events\ProposalTransitioned;
use App\Services\ProgressReportService;
use Illuminate\Support\Facades\Log;

/** A newly funded project gets its progress-report schedule straight away. */
class CreateProgressReportSchedule
{
    public function __construct(private readonly ProgressReportService $reports) {}

    public function handle(ProposalTransitioned $event): void
    {
        if ($event->toStage !== 'funded') {
            return;
        }

        try {
            $this->reports->syncSchedule($event->proposal);
        } catch (\Throwable $e) {
            // The daily sweep creates it later if this fails.
            Log::error("Progress report schedule failed for {$event->proposal->id}: {$e->getMessage()}");
        }
    }
}
