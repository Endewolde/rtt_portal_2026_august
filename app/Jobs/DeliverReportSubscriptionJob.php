<?php

namespace App\Jobs;

use App\Jobs\Concerns\DispatchesToWorkerWhenAlive;
use App\Models\ReportSubscription;
use App\Services\ReportSubscriptionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/** Email one scheduled report. */
class DeliverReportSubscriptionJob implements ShouldQueue
{
    use Dispatchable, DispatchesToWorkerWhenAlive, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 120;

    public function __construct(public string $subscriptionId) {}

    public function handle(ReportSubscriptionService $service): void
    {
        $subscription = ReportSubscription::with('user')->find($this->subscriptionId);

        if (! $subscription || ! $subscription->active || ! $subscription->user) {
            return;
        }

        $service->send($subscription);
    }

    public function failed(\Throwable $e): void
    {
        Log::error("Scheduled report {$this->subscriptionId} could not be sent: {$e->getMessage()}");
    }
}
