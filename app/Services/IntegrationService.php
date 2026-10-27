<?php

namespace App\Services;

use App\Jobs\DeliverWebhookJob;
use App\Models\ApiKey;
use App\Models\User;
use App\Models\Webhook;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/** API keys for other systems, and the webhooks that tell them when something changes. */
class IntegrationService
{
    /**
     * A new key. The plain key is returned only here — afterwards only its hash exists.
     *
     * @param  list<string>  $scopes
     * @return array{key: ApiKey, plain: string}
     */
    public function createKey(string $name, array $scopes, User $by): array
    {
        $plain = 'rtt_'.Str::random(40);
        $key = ApiKey::create([
            'name' => $name,
            'prefix' => substr($plain, 0, 10),
            'key_hash' => hash('sha256', $plain),
            'scopes' => array_values(array_intersect(ApiKey::SCOPES, $scopes)),
            'created_by' => $by->id,
        ]);

        return ['key' => $key, 'plain' => $plain];
    }

    public function findKey(?string $plain): ?ApiKey
    {
        if (! $plain || ! str_starts_with($plain, 'rtt_')) {
            return null;
        }

        return ApiKey::where('key_hash', hash('sha256', $plain))->whereNull('revoked_at')->first();
    }

    /**
     * Queue a call to every active webhook that listens for this event.
     *
     * @param  array<string, mixed>  $data
     */
    public function dispatch(string $event, array $data): void
    {
        try {
            Webhook::where('active', true)->get()
                ->filter(fn (Webhook $w) => in_array($event, $w->events ?? [], true))
                ->each(fn (Webhook $w) => DeliverWebhookJob::deliver($w->id, $event, $data));
        } catch (\Throwable $e) {
            Log::warning("Webhooks for {$event} not queued: {$e->getMessage()}");
        }
    }
}
