<?php

use App\Models\ApiKey;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
    $college = College::create(['name' => 'API College', 'code' => 'AP'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'APD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'ap-'.rand(10000, 99999),
        'start_date' => now(), 'end_date' => now()->addMonth(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->admin->id,
    ]);
    $pi = User::factory()->create(['name' => 'Integration PI']);
    $this->proposal = Proposal::create([
        'tracker_number' => 'API-1', 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'Connected',
        'status' => 'submitted', 'pi_user_id' => $pi->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026-2027', 'created_by' => $pi->id,
    ]);
    Proposal::create([
        'tracker_number' => 'API-DRAFT', 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'Hidden draft',
        'status' => 'draft', 'pi_user_id' => $pi->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026-2027', 'created_by' => $pi->id,
    ]);
});

test('an admin creates a key that is shown once and reads only what its scopes allow', function () {
    $key = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/integrations/keys', ['name' => 'ERP', 'scopes' => ['proposals']])
        ->assertCreated()->json('data.key');

    expect($key)->toStartWith('rtt_')
        ->and(ApiKey::first()->key_hash)->toBe(hash('sha256', $key));
    $this->getJson('/api/v1/integrations')->assertJsonMissing(['key' => $key]);

    app('auth')->forgetGuards();
    $this->withToken($key)->getJson('/api/integrations/v1/proposals')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.tracker_number', 'API-1')
        ->assertJsonPath('data.0.principal_investigator', 'Integration PI');
    $this->withToken($key)->getJson('/api/integrations/v1/proposals/API-1')->assertOk()->assertJsonPath('data.title', 'Connected');
    $this->withToken($key)->getJson('/api/integrations/v1/awards')->assertForbidden();
    $this->withToken('rtt_wrong')->getJson('/api/integrations/v1/proposals')->assertUnauthorized();
});

test('a revoked key stops working, and the API never needs a user session', function () {
    $key = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/integrations/keys', ['name' => 'Site', 'scopes' => ['reports']])->json('data.key');
    $id = ApiKey::first()->id;

    app('auth')->forgetGuards();
    $this->withToken($key)->getJson('/api/integrations/v1/reports/review_progress_pipeline')->assertOk()->assertJsonPath('meta.report', 'review_progress_pipeline');

    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/integrations/keys/{$id}/revoke")->assertOk();
    app('auth')->forgetGuards();
    $this->withToken($key)->getJson('/api/integrations/v1/reports/review_progress_pipeline')->assertUnauthorized();
});

test('a stage change calls the subscribed webhook with a signed body', function () {
    Http::fake(['hooks.example.org/*' => Http::response('ok', 200)]);
    $secret = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/integrations/webhooks', [
        'name' => 'Website', 'url' => 'https://hooks.example.org/rtt', 'events' => ['proposal.status_changed'],
    ])->assertCreated()->json('data.secret');

    $this->proposal->update(['status' => 'validated']);

    Http::assertSent(function (Request $r) use ($secret) {
        $payload = json_decode($r->body(), true);

        return $r->url() === 'https://hooks.example.org/rtt'
            && $r->header('X-RTT-Event')[0] === 'proposal.status_changed'
            && $r->header('X-RTT-Signature')[0] === 'sha256='.hash_hmac('sha256', $r->body(), $secret)
            && $payload['data']['previous_status'] === 'submitted'
            && $payload['data']['status'] === 'validated';
    });
    expect(WebhookDelivery::where('succeeded', true)->count())->toBe(1);
});

test('failing webhooks are logged and switched off after repeated failures', function () {
    Http::fake(['*' => Http::response('down', 500)]);
    $webhook = Webhook::create(['name' => 'Flaky', 'url' => 'https://down.example.org', 'secret' => 'whsec_x', 'events' => ['proposal.status_changed'], 'active' => true, 'consecutive_failures' => Webhook::MAX_FAILURES - 1]);

    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/integrations/webhooks/{$webhook->id}/test")->assertUnprocessable();

    expect($webhook->fresh()->active)->toBeFalse()
        ->and(WebhookDelivery::first()->status_code)->toBe(500);
});

test('only integration managers can manage keys and webhooks', function () {
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')->getJson('/api/v1/integrations')->assertForbidden();
    $this->actingAs($officer, 'sanctum')->postJson('/api/v1/integrations/keys', ['name' => 'X', 'scopes' => ['proposals']])->assertForbidden();
});
