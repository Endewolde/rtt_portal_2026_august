<?php

namespace App\Jobs;

use App\Jobs\Concerns\DispatchesToWorkerWhenAlive;
use App\Models\ReportSnapshot;
use App\Services\ReportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateReportJob implements ShouldQueue
{
    use DispatchesToWorkerWhenAlive, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 300;

    public function __construct(public string $snapshotId)
    {
        $this->onQueue('reports');
    }

    public function handle(ReportService $service): void
    {
        $snapshot = ReportSnapshot::find($this->snapshotId);

        if (! $snapshot) {
            return;
        }

        try {
            $result = $service->runReport($snapshot->report_type, $snapshot->filters ?? []);
            $snapshot->update([
                'status'       => 'ready',
                'result'       => $result,
                'completed_at' => now(),
            ]);
        } catch (\Exception $e) {
            $snapshot->update(['status' => 'failed']);
            Log::error("GenerateReportJob failed for snapshot {$this->snapshotId}", [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
