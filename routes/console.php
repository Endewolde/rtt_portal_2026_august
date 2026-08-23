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
