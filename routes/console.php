<?php

use App\Jobs\QueueHeartbeatJob;
use App\Models\AppSetting;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('users:deactivate-expired-guests')->daily();
// rtt:deadline-reminders, rtt:expire-calls, metrics and cache jobs are scheduled in
// bootstrap/app.php (withSchedule) — don't register them here too, or they run twice.
Schedule::command('rtt:review-deadline-reminders')->dailyAt('08:15');
Schedule::command('notifications:send-digests daily')->dailyAt('07:00');
Schedule::command('notifications:send-digests weekly')->weeklyOn(1, '07:00');
Schedule::command('rtt:track-ethical-clearance-expiry')->dailyAt('08:30');
Schedule::command('rtt:defence-deadlines')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('rtt:progress-reports')->dailyAt('07:30')->withoutOverlapping();
Schedule::command('rtt:risk-digest')->weeklyOn(1, '07:45')->withoutOverlapping();
Schedule::command('rtt:officer-digest')->weekdays()->at('07:15')->withoutOverlapping();
Schedule::command('rtt:contract-chase')->dailyAt('09:00')->withoutOverlapping();
Schedule::command('rtt:stage-escalations')->weekdays()->at('09:15')->withoutOverlapping();
Schedule::command('rtt:report-subscriptions')->dailyAt('06:30')->withoutOverlapping();

// Backups run 3x/day, admin-configurable via Settings — Backup & Recovery
// (backup_time / backup_time_2 / backup_time_3), defaulting to 6 AM / 6 PM / midnight.
$autoBackupEnabled = fn () => AppSetting::where('key', 'auto_backup_enabled')->value('value') === 'true';
$backupTimeDefaults = ['backup_time' => '06:00', 'backup_time_2' => '18:00', 'backup_time_3' => '00:00'];

foreach ($backupTimeDefaults as $settingKey => $default) {
    $backupRunTime = AppSetting::where('key', $settingKey)->value('value') ?: $default;

    Schedule::command('backup:run')
        ->dailyAt($backupRunTime)
        ->when($autoBackupEnabled)
        ->onFailure(fn () => Log::error("[Scheduler] Backup failed (scheduled {$backupRunTime})."));
}

// Lets the app see whether a queue worker is running (mail is queued only while one is).
Schedule::call(fn () => QueueHeartbeatJob::queueIfIdle())->name('queue-worker-heartbeat')->everyMinute()->withoutOverlapping();

// Retention settings (drafts, read notifications, unused accounts) — each off until configured.
Schedule::command('rtt:data-retention')->dailyAt('02:30');

// Completed projects move to the archive 30 days after completion.
Schedule::command('proposals:archive-completed')->dailyAt('03:00');
