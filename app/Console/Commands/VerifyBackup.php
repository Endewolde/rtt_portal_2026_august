<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

#[Signature('backup:verify')]
#[Description('Check that the newest database dump and files archive can be restored from.')]
class VerifyBackup extends Command
{
    public function handle(BackupService $backup): int
    {
        $result = $backup->verify();
        $this->line("Database: {$result['database']}");
        $this->line("Files:    {$result['files']}");

        $healthy = str_starts_with($result['database'], 'ok') && ! str_starts_with($result['files'], 'corrupt');
        if (! $healthy) {
            Log::error('[Backup] Verification failed: '.json_encode($result));
        }

        return $healthy ? self::SUCCESS : self::FAILURE;
    }
}
