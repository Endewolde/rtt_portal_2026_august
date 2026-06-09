<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupExpiredTelegramTokens extends Command
{
    protected $signature   = 'rtt:cleanup-telegram-tokens';
    protected $description = 'Clear expired Telegram link tokens from user records';

    public function handle(): void
    {
        $count = DB::table('users')
            ->whereNotNull('telegram_link_token')
            ->where('telegram_link_token_expires_at', '<', now())
            ->update([
                'telegram_link_token'            => null,
                'telegram_link_token_expires_at' => null,
            ]);

        $this->info("Cleaned up {$count} expired Telegram token(s).");
    }
}
