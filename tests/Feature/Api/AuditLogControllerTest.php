<?php

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function alc_log(array $overrides = []): AuditLog
{
    return AuditLog::create(array_merge([
        'id' => (string) Str::orderedUuid(),
        'auditable_type' => User::class,
        'auditable_id' => (string) Str::orderedUuid(),
        'event' => 'user.updated',
        'actor_id' => null,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'PestTest',
        'created_at' => now(),
    ], $overrides));
}

test('a user without audit_logs.view_any is forbidden', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/audit-logs')
        ->assertStatus(403);
});

test('an admin with the permission can list audit logs', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    alc_log(['actor_id' => $admin->id, 'event' => 'proposal.created']);

    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/audit-logs')
        ->assertOk()
        ->assertJsonPath('data.data.0.event', 'proposal.created');
});

test('entries authored by a super_admin are excluded from the list, even for another admin', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    alc_log(['actor_id' => $superAdmin->id, 'event' => 'user.super_admin_created']);

    $admin = User::factory()->create();
    $admin->assignRole('admin');
    alc_log(['actor_id' => $admin->id, 'event' => 'proposal.created']);

    $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/audit-logs')->assertOk();
    $events = collect($response->json('data.data'))->pluck('event');

    expect($events)->toContain('proposal.created')
        ->and($events)->not->toContain('user.super_admin_created');
});

test('entries authored by a super_admin are excluded even when a super_admin is the viewer', function () {
    $superAdminA = User::factory()->create();
    $superAdminA->assignRole('super_admin');
    alc_log(['actor_id' => $superAdminA->id, 'event' => 'user.super_admin_created']);

    $superAdminB = User::factory()->create();
    $superAdminB->assignRole('super_admin');

    $response = $this->actingAs($superAdminB, 'sanctum')->getJson('/api/v1/audit-logs')->assertOk();
    $events = collect($response->json('data.data'))->pluck('event');

    expect($events)->not->toContain('user.super_admin_created');
});

test('system-generated entries with no actor are still shown', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    alc_log(['actor_id' => null, 'event' => 'proposal_call.expired']);

    $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/audit-logs')->assertOk();
    $events = collect($response->json('data.data'))->pluck('event');

    expect($events)->toContain('proposal_call.expired');
});

test('category filter narrows results by event prefix', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    alc_log(['actor_id' => $admin->id, 'event' => 'budget.request_approved']);
    alc_log(['actor_id' => $admin->id, 'event' => 'proposal.created']);

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/audit-logs?category=finance')
        ->assertOk();
    $events = collect($response->json('data.data'))->pluck('event');

    expect($events)->toContain('budget.request_approved')
        ->and($events)->not->toContain('proposal.created');
});

test('search matches actor name', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $actor = User::factory()->create(['name' => 'Distinctive Searchname']);
    alc_log(['actor_id' => $actor->id, 'event' => 'proposal.updated']);
    alc_log(['actor_id' => $admin->id, 'event' => 'proposal.created']);

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/audit-logs?q=Distinctive+Searchname')
        ->assertOk();

    expect($response->json('data.data'))->toHaveCount(1)
        ->and($response->json('data.data.0.event'))->toBe('proposal.updated');
});

// ─── export() ────────────────────────────────────────────────────────────────

test('a user without audit_logs.view_any cannot export the audit log', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');

    $this->actingAs($user, 'sanctum')
        ->get('/api/v1/audit-logs/export')
        ->assertStatus(403);
});

test('export produces a CSV with the expected rows and excludes super_admin entries', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    alc_log(['actor_id' => $admin->id, 'event' => 'proposal.created']);

    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    alc_log(['actor_id' => $superAdmin->id, 'event' => 'user.super_admin_created']);

    $response = $this->actingAs($admin, 'sanctum')->get('/api/v1/audit-logs/export');

    $response->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    $csv = $response->streamedContent();

    expect($csv)->toContain('proposal.created')
        ->and($csv)->not->toContain('user.super_admin_created');
});

test('export respects the same filters as index()', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    alc_log(['actor_id' => $admin->id, 'event' => 'budget.request_approved']);
    alc_log(['actor_id' => $admin->id, 'event' => 'proposal.created']);

    $response = $this->actingAs($admin, 'sanctum')->get('/api/v1/audit-logs/export?category=finance');
    $csv = $response->streamedContent();

    expect($csv)->toContain('budget.request_approved')
        ->and($csv)->not->toContain('proposal.created');
});
