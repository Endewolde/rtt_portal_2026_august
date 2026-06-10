<?php

namespace App\Services;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class BackupService
{
    private string $backupDir;

    public function __construct()
    {
        $this->backupDir = storage_path('app/private/backups');
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Run a full database backup, optionally deliver via email and/or Telegram.
     *
     * @return array{filename:string, size_mb:float, path:string, delivered:array}
     *
     * @throws \Exception
     */
    public function run(bool $sendEmail = true, bool $sendTelegram = true): array
    {
        $this->ensureDirectory();

        $filename = 'rtt_backup_'.now()->format('Y-m-d_H-i-s').'.sql.gz';
        $path = $this->backupDir.'/'.$filename;

        $this->dump($path);

        $sizeMb = round(filesize($path) / 1024 / 1024, 2);
        $sizeStr = $sizeMb < 0.1 ? round(filesize($path) / 1024, 1).' KB' : $sizeMb.' MB';

        $delivered = [];

        if ($sendEmail) {
            try {
                $this->deliverEmail($path, $filename, $sizeStr);
                $delivered[] = 'email';
            } catch (\Exception $e) {
                Log::error('[Backup] Email delivery failed: '.$e->getMessage());
            }
        }

        if ($sendTelegram) {
            try {
                $this->deliverTelegram($path, $filename, $sizeStr);
                $delivered[] = 'telegram';
            } catch (\Exception $e) {
                Log::error('[Backup] Telegram delivery failed: '.$e->getMessage());
            }
        }

        $this->cleanup();
        $this->recordMeta($filename, $sizeStr, 'success');

        return compact('filename', 'sizeMb', 'path', 'delivered');
    }

    /**
     * List recent backup files from disk, newest first.
     *
     * @return array<array{filename:string, size:string, created_at:string}>
     */
    public function history(): array
    {
        if (! is_dir($this->backupDir)) {
            return [];
        }

        $files = [];
        foreach (scandir($this->backupDir) as $file) {
            if (! str_ends_with($file, '.sql.gz')) {
                continue;
            }
            $full = $this->backupDir.'/'.$file;
            $bytes = filesize($full);
            $sizeMb = round($bytes / 1024 / 1024, 2);
            $sizeStr = $sizeMb < 0.1 ? round($bytes / 1024, 1).' KB' : $sizeMb.' MB';
            $files[] = [
                'filename' => $file,
                'size' => $sizeStr,
                'created_at' => date('Y-m-d H:i:s', filemtime($full)),
            ];
        }

        usort($files, fn ($a, $b) => strcmp($b['created_at'], $a['created_at']));

        return array_values($files);
    }

    /** Absolute path for a given backup filename (validates it stays within backupDir). */
    public function resolveFile(string $filename): string
    {
        $path = $this->backupDir.'/'.basename($filename);
        if (! file_exists($path)) {
            throw new \Exception("Backup file not found: {$filename}");
        }

        return $path;
    }

    // ── Core dump ─────────────────────────────────────────────────────────────

    private function dump(string $outPath): void
    {
        $db = config('database.connections.'.config('database.default'));

        $host = escapeshellarg($db['host'] ?? '127.0.0.1');
        $port = escapeshellarg($db['port'] ?? '3306');
        $user = escapeshellarg($db['username']);
        $dbName = escapeshellarg($db['database']);
        $outEsc = escapeshellarg($outPath);
        $dumpBin = trim(shell_exec('which mysqldump 2>/dev/null') ?? '') ?: 'mysqldump';

        // Pass password via MYSQL_PWD env var — avoids it appearing in the process list.
        $envPrefix = '';
        if (! empty($db['password'])) {
            $envPrefix = 'MYSQL_PWD='.escapeshellarg($db['password']).' ';
        }

        $cmd = "{$envPrefix}{$dumpBin} -h{$host} -P{$port} -u{$user} {$dbName} | gzip > {$outEsc} 2>&1";
        exec($cmd, $output, $exitCode);

        if ($exitCode !== 0 || ! file_exists($outPath) || filesize($outPath) === 0) {
            throw new \Exception("mysqldump failed (exit {$exitCode}). Check server logs.");
        }
    }

    // ── Delivery ──────────────────────────────────────────────────────────────

    private function deliverEmail(string $path, string $filename, string $size): void
    {
        app(MailConfigService::class)->applyFromDatabase();

        $recipient = AppSetting::where('key', 'backup_email_recipient')->value('value')
            ?? config('mail.from.address');

        if (! $recipient) {
            throw new \Exception('No backup email recipient configured.');
        }

        Mail::html(
            view('emails.backup', [
                'filename' => $filename,
                'size' => $size,
                'backupDate' => now()->format('d M Y, H:i'),
                'senderName' => config('mail.from.name', 'RTT Platform'),
            ])->render(),
            function ($msg) use ($path, $filename, $recipient) {
                $msg->to($recipient)
                    ->subject('RTT Platform — Database Backup '.now()->format('d M Y'))
                    ->attach($path, ['as' => $filename, 'mime' => 'application/gzip']);
            }
        );
    }

    private function deliverTelegram(string $path, string $filename, string $size): void
    {
        $token = AppSetting::where('key', 'telegram_bot_token')->value('value');
        $chatId = AppSetting::where('key', 'backup_telegram_chat_id')->value('value');

        if (! $token || ! $chatId) {
            throw new \Exception('Telegram bot token or backup chat ID not configured.');
        }

        $caption = "🗄 *RTT Platform Database Backup*\n"
            .'📅 '.now()->format('d M Y, H:i')."\n"
            ."📦 {$size}\n"
            ."📁 `{$filename}`";

        $ch = curl_init("https://api.telegram.org/bot{$token}/sendDocument");
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_POSTFIELDS => [
                'chat_id' => $chatId,
                'document' => new \CURLFile($path, 'application/gzip', $filename),
                'caption' => $caption,
                'parse_mode' => 'Markdown',
            ],
        ]);

        $raw = curl_exec($ch);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            throw new \Exception("Telegram cURL error: {$curlErr}");
        }

        $resp = json_decode($raw, true);
        if (! ($resp['ok'] ?? false)) {
            throw new \Exception('Telegram API error: '.($resp['description'] ?? 'Unknown'));
        }
    }

    // ── Housekeeping ──────────────────────────────────────────────────────────

    private function cleanup(): void
    {
        $retainDays = (int) (AppSetting::where('key', 'backup_retention_days')->value('value') ?? 30);
        $cutoff = time() - ($retainDays * 86400);

        foreach (scandir($this->backupDir) as $file) {
            if (! str_ends_with($file, '.sql.gz')) {
                continue;
            }
            $full = $this->backupDir.'/'.$file;
            if (filemtime($full) < $cutoff) {
                unlink($full);
                Log::info("[Backup] Deleted old backup: {$file}");
            }
        }
    }

    private function ensureDirectory(): void
    {
        if (! is_dir($this->backupDir)) {
            mkdir($this->backupDir, 0750, true);
        }
    }

    private function recordMeta(string $filename, string $size, string $status): void
    {
        $meta = [
            'last_backup_at' => now()->toDateTimeString(),
            'last_backup_size' => $size,
            'last_backup_status' => $status,
            'last_backup_file' => $filename,
        ];

        foreach ($meta as $key => $value) {
            AppSetting::updateOrCreate(
                ['key' => $key],
                ['value' => $value, 'type' => 'string', 'group' => 'backup', 'description' => $key]
            );
        }
    }
}
