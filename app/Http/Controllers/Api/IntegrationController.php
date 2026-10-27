<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\DeliverWebhookJob;
use App\Models\ApiKey;
use App\Models\Webhook;
use App\Services\IntegrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Administration of API keys and webhooks (Admin → API & Webhooks). */
class IntegrationController extends Controller
{
    public function __construct(private IntegrationService $integrations) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('integrations.manage')) {
            return $this->forbidden();
        }

        return $this->ok([
            'keys' => ApiKey::latest()->get()->map(fn (ApiKey $k) => [
                'id' => $k->id, 'name' => $k->name, 'prefix' => $k->prefix, 'scopes' => $k->scopes,
                'last_used_at' => $k->last_used_at?->toIso8601String(), 'revoked_at' => $k->revoked_at?->toIso8601String(),
                'created_at' => $k->created_at?->toIso8601String(),
            ]),
            'webhooks' => Webhook::with(['deliveries' => fn ($q) => $q->limit(10)])->latest()->get()->map(fn (Webhook $w) => [
                'id' => $w->id, 'name' => $w->name, 'url' => $w->url, 'events' => $w->events, 'active' => $w->active,
                'consecutive_failures' => $w->consecutive_failures, 'last_delivered_at' => $w->last_delivered_at?->toIso8601String(),
                'deliveries' => $w->deliveries->map(fn ($d) => $d->only(['id', 'event', 'status_code', 'succeeded', 'response', 'duration_ms']) + ['created_at' => $d->created_at?->toIso8601String()]),
            ]),
            'scopes' => ApiKey::SCOPES,
            'events' => Webhook::EVENTS,
            'base_url' => rtrim(config('app.url'), '/').'/api/integrations/v1',
        ]);
    }

    public function storeKey(Request $request): JsonResponse
    {
        if (! $request->user()?->can('integrations.manage')) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*' => [Rule::in(ApiKey::SCOPES)],
        ]);

        ['key' => $key, 'plain' => $plain] = $this->integrations->createKey($data['name'], $data['scopes'], $request->user());

        return $this->ok(['id' => $key->id, 'name' => $key->name, 'key' => $plain], 'Key created. Copy it now — it will not be shown again.', 201);
    }

    public function revokeKey(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('integrations.manage')) {
            return $this->forbidden();
        }

        ApiKey::findOrFail($id)->forceFill(['revoked_at' => now()])->save();

        return $this->ok(null, 'Key revoked. Systems using it can no longer connect.');
    }

    public function storeWebhook(Request $request): JsonResponse
    {
        if (! $request->user()?->can('integrations.manage')) {
            return $this->forbidden();
        }

        $data = $this->validateWebhook($request);
        $secret = 'whsec_'.Str::random(32);
        $webhook = Webhook::create($data + ['secret' => $secret, 'active' => true, 'created_by' => $request->user()->id]);

        return $this->ok(['id' => $webhook->id, 'secret' => $secret], 'Webhook added. Copy the signing secret now — it will not be shown again.', 201);
    }

    public function updateWebhook(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('integrations.manage')) {
            return $this->forbidden();
        }

        $webhook = Webhook::findOrFail($id);
        $data = $this->validateWebhook($request, partial: true) + $request->validate(['active' => ['sometimes', 'boolean']]);
        if (($data['active'] ?? false) === true) {
            $data['consecutive_failures'] = 0;
        }
        $webhook->update($data);

        return $this->ok(null, 'Webhook updated.');
    }

    public function destroyWebhook(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('integrations.manage')) {
            return $this->forbidden();
        }

        Webhook::findOrFail($id)->delete();

        return $this->ok(null, 'Webhook removed.');
    }

    /** Send a test event now, so the receiving system can be checked. */
    public function testWebhook(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('integrations.manage')) {
            return $this->forbidden();
        }

        $webhook = Webhook::findOrFail($id);
        DeliverWebhookJob::dispatchSync($webhook->id, 'ping', ['message' => 'Test delivery from the RTT Platform.', 'webhook' => $webhook->name]);
        $last = $webhook->deliveries()->first();

        return $last?->succeeded
            ? $this->ok(null, "Delivered — the system answered {$last->status_code}.")
            : response()->json(['data' => null, 'message' => 'Not delivered'.($last?->status_code ? " — the system answered {$last->status_code}." : ': '.Str::limit((string) $last?->response, 120)), 'errors' => []], 422);
    }

    /** @return array<string, mixed> */
    private function validateWebhook(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$req, 'string', 'max:120'],
            'url' => [$req, 'url:https,http', 'max:500'],
            'events' => [$req, 'array', 'min:1'],
            'events.*' => [Rule::in(array_keys(Webhook::EVENTS))],
        ]);
    }

    private function ok(mixed $data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
    }
}
