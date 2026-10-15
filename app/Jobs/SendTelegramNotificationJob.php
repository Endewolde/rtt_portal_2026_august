<?php

namespace App\Jobs;

use App\Jobs\Concerns\DispatchesToWorkerWhenAlive;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendTelegramNotificationJob implements ShouldQueue
{
    use DispatchesToWorkerWhenAlive, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        public string $chatId,
        public string $event,
        public array $data
    ) {
        $this->onQueue('notifications');
    }

    public function handle(): void
    {
        $token = config('services.telegram.bot_token');

        if (empty($token) || $token === 'fake_token_for_testing') {
            return;
        }

        $message = $this->buildMessage();

        try {
            $response = Http::timeout(10)->post(
                "https://api.telegram.org/bot{$token}/sendMessage",
                ['chat_id' => $this->chatId, 'text' => $message, 'parse_mode' => 'HTML']
            );

            if (! $response->successful()) {
                Log::warning('Telegram notification failed', [
                    'chat_id'  => $this->chatId,
                    'event'    => $this->event,
                    'response' => $response->body(),
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Telegram notification exception', [
                'chat_id' => $this->chatId,
                'event'   => $this->event,
                'error'   => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function buildMessage(): string
    {
        return match ($this->event) {
            'submission_success' =>
                "✅ <b>Proposal Submitted</b>\n".
                'Tracker: <code>'.($this->data['tracker_number'] ?? '')."</code>\n".
                'Title: '.($this->data['title'] ?? ''),

            'review_assignment' =>
                "📋 <b>New Review Assignment</b>\n".
                'Proposal: <code>'.($this->data['tracker_number'] ?? '')."</code>\n".
                'Due: '.($this->data['due_date'] ?? ''),

            'decision_result' =>
                "🏆 <b>Proposal Decision</b>\n".
                'Result: '.strtoupper($this->data['decision'] ?? '')."\n".
                'Tracker: <code>'.($this->data['tracker_number'] ?? '').'</code>',

            'award_approval' =>
                "🎉 <b>Proposal Funded!</b>\n".
                'Grant Ref: <code>'.($this->data['grant_reference'] ?? '')."</code>\n".
                'Amount: '.($this->data['awarded_amount'] ?? ''),

            'signature_requested' =>
                "✍️ <b>Signature Required</b>\n".
                'Budget Request Round '.($this->data['round_number'] ?? '')."\n".
                'Please sign in the RTT platform.',

            'settlement_verified' =>
                "✅ <b>Settlement Verified</b>\n".
                'Round '.($this->data['round_number'] ?? '')." settled.\n".
                'You can now submit Round '.(($this->data['round_number'] ?? 0) + 1).'.',

            default =>
                "🔔 <b>RTT Platform Notification</b>\n".
                ($this->data['message'] ?? 'You have a new notification.'),
        };
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Telegram notification job permanently failed', [
            'event'   => $this->event,
            'chat_id' => $this->chatId,
            'error'   => $exception->getMessage(),
        ]);
    }
}
