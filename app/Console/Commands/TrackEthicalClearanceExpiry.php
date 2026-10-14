<?php

namespace App\Console\Commands;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class TrackEthicalClearanceExpiry extends Command
{
    protected $signature = 'rtt:track-ethical-clearance-expiry';

    protected $description = 'Remind PIs of approaching ethical clearance expiry and mark past-due clearances as expired';

    public function handle(): int
    {
        $reminded = 0;
        foreach ([14, 7, 1] as $days) {
            $targetDate = now()->addDays($days)->toDateString();

            $expiringSoon = Proposal::where('ethical_clearance_status', 'approved')
                ->whereDate('ethical_clearance_expiry', $targetDate)
                ->with('pi')
                ->get();

            foreach ($expiringSoon as $proposal) {
                if (! $proposal->pi) {
                    continue;
                }

                $data = [
                    'tracker_number' => $proposal->tracker_number,
                    'title' => $proposal->title,
                    'days_remaining' => $days,
                    'expiry_date' => $proposal->ethical_clearance_expiry->format('d M Y'),
                ];

                try {
                    SendEmailNotificationJob::deliver($proposal->pi, 'ethical_clearance_expiring', $data);
                    StoreInAppNotificationJob::dispatchSync($proposal->pi->id, 'ethical_clearance_expiring', $data);
                    $reminded++;
                } catch (\Throwable $e) {
                    Log::error("Ethical clearance expiry reminder failed for proposal {$proposal->id}: {$e->getMessage()}");
                }
            }
        }

        $expired = Proposal::where('ethical_clearance_status', 'approved')
            ->whereDate('ethical_clearance_expiry', '<', now()->toDateString())
            ->with('pi')
            ->get();

        foreach ($expired as $proposal) {
            $proposal->update(['ethical_clearance_status' => 'expired']);

            if ($proposal->pi) {
                try {
                    SendEmailNotificationJob::deliver($proposal->pi, 'ethical_clearance_expired', [
                        'tracker_number' => $proposal->tracker_number,
                        'title' => $proposal->title,
                    ]);
                } catch (\Throwable $e) {
                    Log::error("Ethical clearance expired notify failed for proposal {$proposal->id}: {$e->getMessage()}");
                }
            }
        }

        $this->info("Sent {$reminded} expiry reminder(s). Marked {$expired->count()} clearance(s) expired.");

        return self::SUCCESS;
    }
}
