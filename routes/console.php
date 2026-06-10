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

$backupTime = AppSetting::where('key', 'backup_time')->value('value') ?? '02:00';

Schedule::command('backup:run')
    ->dailyAt($backupTime)
    ->when(fn () => AppSetting::where('key', 'auto_backup_enabled')->value('value') === 'true')
    ->onFailure(fn () => Log::error('[Scheduler] Daily backup failed.'));
