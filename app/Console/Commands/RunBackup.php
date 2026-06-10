<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use App\Services\BackupService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('backup:run
    {--email : Force email delivery regardless of settings}
    {--telegram : Force Telegram delivery regardless of settings}
    {--no-email : Skip email delivery}
    {--no-telegram : Skip Telegram delivery}
')]
#[Description('Run a full database backup and deliver via configured channels.')]
class RunBackup extends Command
{
    public function handle(BackupService $backup): int
    {
        $this->info('[Backup] Starting database backup…');

        $sendEmail = $this->resolveChannel('backup_notify_email', 'email', 'no-email');
        $sendTelegram = $this->resolveChannel('backup_notify_telegram', 'telegram', 'no-telegram');

        try {
            $result = $backup->run($sendEmail, $sendTelegram);

            $this->info("[Backup] ✓ {$result['filename']} ({$result['sizeMb']} MB)");

            if (! empty($result['delivered'])) {
                $this->info('[Backup] Delivered via: '.implode(', ', $result['delivered']));
            } else {
                $this->warn('[Backup] No delivery channels were active.');
            }

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error('[Backup] Failed: '.$e->getMessage());

            return self::FAILURE;
        }
    }

    private function resolveChannel(string $settingKey, string $forceOption, string $skipOption): bool
    {
        if ($this->option($skipOption)) {
            return false;
        }
        if ($this->option($forceOption)) {
            return true;
        }

        return AppSetting::where('key', $settingKey)->value('value') === 'true';
    }
}
