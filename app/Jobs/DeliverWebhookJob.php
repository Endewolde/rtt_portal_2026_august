<?php

namespace App\Jobs;

use App\Jobs\Concerns\DispatchesToWorkerWhenAlive;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Call one webhook: a JSON POST signed with the webhook's secret
 * (X-RTT-Signature: sha256=HMAC of the body), recorded in its delivery log.
 */
class DeliverWebhookJob implements ShouldQueue
{
    use Dispatchable, DispatchesToWorkerWhenAlive, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300];

    /** @param  array<string, mixed>  $data */
    public function __construct(public string $webhookId, public string $event, public array $data) {}

    public function handle(): void
    {
        $webhook = Webhook::find($this->webhookId);
        if (! $webhook || ! $webhook->active) {
            return;
        }

        $deliveryId = (string) Str::uuid();
        $body = json_encode(['id' => $deliveryId, 'event' => $this->event, 'sent_at' => now()->toIso8601String(), 'data' => $this->data], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $started = microtime(true);
        $status = null;
        $response = null;

        try {
            $http = Http::timeout(10)->withHeaders([
                'Content-Type' => 'application/json',
                'User-Agent' => 'RTT-Platform-Webhooks/1.0',
                'X-RTT-Event' => $this->event,
                'X-RTT-Delivery' => $deliveryId,
                'X-RTT-Signature' => 'sha256='.hash_hmac('sha256', $body, $webhook->secret),
            ])->withBody($body, 'application/json')->post($webhook->url);
            $status = $http->status();
            $response = Str::limit($http->body(), 480);
        } catch (\Throwable $e) {
            $response = Str::limit($e->getMessage(), 480);
        }

        $ok = $status !== null && $status >= 200 && $status < 300;
        WebhookDelivery::create([
            'id' => $deliveryId, 'webhook_id' => $webhook->id, 'event' => $this->event, 'status_code' => $status,
            'succeeded' => $ok, 'response' => $response, 'duration_ms' => (int) round((microtime(true) - $started) * 1000), 'created_at' => now(),
        ]);

        $failures = $ok ? 0 : $webhook->consecutive_failures + 1;
        $webhook->forceFill([
            'consecutive_failures' => $failures,
            'last_delivered_at' => $ok ? now() : $webhook->last_delivered_at,
            'active' => $failures < Webhook::MAX_FAILURES,
        ])->save();

        // Keep the log short: the latest 50 attempts per webhook.
        $keep = WebhookDelivery::where('webhook_id', $webhook->id)->latest('created_at')->limit(50)->pluck('id');
        WebhookDelivery::where('webhook_id', $webhook->id)->whereNotIn('id', $keep)->delete();
    }
}
