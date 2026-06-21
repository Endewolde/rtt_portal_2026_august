<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class RegisterTelegramWebhook extends Command
{
    protected $signature = 'telegram:register-webhook {--url= : Override the webhook URL}';

    protected $description = 'Register the Telegram bot webhook with Telegram servers';

    public function handle(): int
    {
        $botToken = AppSetting::where('key', 'telegram_bot_token')->value('value');

        if (! $botToken) {
            $this->error('telegram_bot_token is not configured in app settings.');

            return self::FAILURE;
        }

        $webhookUrl = $this->option('url')
            ?: rtrim(config('app.url'), '/').'/api/v1/auth/telegram/webhook';

        $this->info("Registering webhook: {$webhookUrl}");

        $response = Http::post("https://api.telegram.org/bot{$botToken}/setWebhook", [
            'url' => $webhookUrl,
            'allowed_updates' => ['message'],
        ]);

        $body = $response->json();

        if ($body['ok'] ?? false) {
            $this->info('Webhook registered successfully.');
            $this->line('Description: '.($body['description'] ?? ''));

            return self::SUCCESS;
        }

        $this->error('Failed: '.($body['description'] ?? json_encode($body)));

        return self::FAILURE;
    }
}
