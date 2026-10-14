<?php

namespace App\Console\Commands;

use App\Services\ProgressReportService;
use Illuminate\Console\Command;

class SweepProgressReports extends Command
{
    protected $signature = 'rtt:progress-reports';

    protected $description = 'Keep funded projects\' progress-report schedules current and remind PIs of reports due soon or overdue.';

    public function handle(ProgressReportService $reports): int
    {
        $result = $reports->sweep();

        $this->info("Synced {$result['synced']} project(s); sent {$result['due_soon']} due-soon and {$result['overdue']} overdue reminder(s).");

        return self::SUCCESS;
    }
}
