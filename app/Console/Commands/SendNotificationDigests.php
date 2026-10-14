<?php

namespace App\Console\Commands;

use App\Jobs\SendRawMailJob;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SendNotificationDigests extends Command
{
    protected $signature = 'notifications:send-digests {frequency : daily or weekly}';

    protected $description = 'Email a summary digest to users who opted out of real-time notification email';

    public function handle(): int
    {
        $frequency = $this->argument('frequency');

        if (! in_array($frequency, ['daily', 'weekly'], true)) {
            $this->error('Frequency must be "daily" or "weekly".');

            return self::FAILURE;
        }

        $preferences = NotificationPreference::where('digest_frequency', $frequency)
            ->with('user')
            ->get();

        $sent = 0;
        $skipped = 0;

        foreach ($preferences as $pref) {
            $user = $pref->user;

            if (! $user || ! $user->email) {
                continue;
            }

            $since = $pref->last_digest_sent_at ?? now()->sub($frequency === 'daily' ? '1 day' : '1 week');

            $items = DB::table('notifications')
                ->where('notifiable_type', User::class)
                ->where('notifiable_id', $user->id)
                ->where('created_at', '>=', $since)
                ->orderByDesc('created_at')
                ->get();

            if ($items->isEmpty()) {
                $pref->update(['last_digest_sent_at' => now()]);
                $skipped++;

                continue;
            }

            try {
                $html = view('emails.notifications.digest', [
                    'user' => $user,
                    'items' => $items,
                    'frequency' => $frequency,
                ])->render();

                SendRawMailJob::deliver(
                    $html,
                    $user->email,
                    $user->name,
                    ucfirst($frequency)." Digest — {$items->count()} update".($items->count() === 1 ? '' : 's')
                );
                $sent++;
            } catch (\Throwable $e) {
                Log::error("Notification digest failed for {$user->id}: {$e->getMessage()}");
            }

            $pref->update(['last_digest_sent_at' => now()]);
        }

        $this->info("Sent {$sent} {$frequency} digest(s). Skipped {$skipped} with nothing new.");

        return self::SUCCESS;
    }
}
