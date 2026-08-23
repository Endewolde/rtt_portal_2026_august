<?php

use App\Models\AppSetting;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('users:deactivate-expired-guests')->daily();
Schedule::command('rtt:deadline-reminders')->dailyAt('08:00');
Schedule::command('rtt:review-deadline-reminders')->dailyAt('08:15');

// Backups run 3x/day at fixed times (6:00 AM, 6:00 PM, midnight) rather than
// the single admin-configurable backup_time — replaces it entirely.
$autoBackupEnabled = fn () => AppSetting::where('key', 'auto_backup_enabled')->value('value') === 'true';

foreach (['06:00', '18:00', '00:00'] as $backupRunTime) {
    Schedule::command('backup:run')
        ->dailyAt($backupRunTime)
        ->when($autoBackupEnabled)
        ->onFailure(fn () => Log::error("[Scheduler] Backup failed (scheduled {$backupRunTime})."));
}
