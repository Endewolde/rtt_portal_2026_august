<?php

namespace App\Console\Commands;

use App\Jobs\DeliverReportSubscriptionJob;
use App\Services\ReportSubscriptionService;
use Illuminate\Console\Command;

class SendReportSubscriptions extends Command
{
    protected $signature = 'rtt:report-subscriptions';

    protected $description = 'Email the scheduled reports that are due today.';

    public function handle(ReportSubscriptionService $service): int
    {
        $due = $service->due();

        foreach ($due as $subscription) {
            DeliverReportSubscriptionJob::deliver($subscription->id);
        }

        $this->info("{$due->count()} scheduled report(s) sent.");

        return self::SUCCESS;
    }
}
