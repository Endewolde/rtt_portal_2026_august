<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function monitor_admin(): User
{
    $user = User::factory()->create();
    $user->assignRole('super_admin');

    return $user;
}

function monitor_plain(): User
{
    $user = User::factory()->create();
    $user->assignRole('pi');

    return $user;
}

test('current endpoint returns snapshot for admin', function () {
    // Seed at least one metric so snapshot has data
    DB::table('system_metrics')->insert([
        ['metric' => 'cpu_usage_pct', 'value' => 15.0, 'meta' => null, 'recorded_at' => now()],
        ['metric' => 'memory_used_pct', 'value' => 60.0, 'meta' => json_encode(['used_gb' => 8, 'total_gb' => 16]), 'recorded_at' => now()],
        ['metric' => 'disk_used_pct', 'value' => 55.0, 'meta' => null, 'recorded_at' => now()],
    ]);

    $this->actingAs(monitor_admin(), 'sanctum')
        ->getJson('/api/v1/system-monitor/current')
        ->assertOk()
        ->assertJsonPath('data.server.cpu_pct', 15)
        ->assertJsonPath('data.server.memory_pct', 60)
        ->assertJsonStructure(['data' => ['server', 'app', 'alerts_count', 'collected_at']]);
});

test('current endpoint denies non-admin', function () {
    $this->actingAs(monitor_plain(), 'sanctum')
        ->getJson('/api/v1/system-monitor/current')
        ->assertForbidden();
});

test('history endpoint returns grouped metrics', function () {
    $now = now();
    DB::table('system_metrics')->insert([
        ['metric' => 'cpu_usage_pct', 'value' => 20.0, 'meta' => null, 'recorded_at' => $now->copy()->subMinutes(2)],
        ['metric' => 'cpu_usage_pct', 'value' => 25.0, 'meta' => null, 'recorded_at' => $now],
        ['metric' => 'memory_used_pct', 'value' => 50.0, 'meta' => null, 'recorded_at' => $now],
    ]);

    $r = $this->actingAs(monitor_admin(), 'sanctum')
        ->getJson('/api/v1/system-monitor/history?minutes=30')
        ->assertOk();

    expect($r->json('data'))->toHaveKey('cpu_usage_pct')
        ->and(count($r->json('data.cpu_usage_pct')))->toBe(2);
});

test('request stats returns aggregate counts', function () {
    DB::table('request_logs')->insert([
        ['method' => 'GET', 'path' => '/api/v1/proposals', 'status_code' => 200, 'duration_ms' => 120, 'ip' => '127.0.0.1', 'user_id' => null, 'is_api' => 1, 'requested_at' => now()],
        ['method' => 'POST', 'path' => '/api/v1/auth/login', 'status_code' => 401, 'duration_ms' => 80, 'ip' => '127.0.0.1', 'user_id' => null, 'is_api' => 1, 'requested_at' => now()],
        ['method' => 'GET', 'path' => '/api/v1/slow', 'status_code' => 200, 'duration_ms' => 3500, 'ip' => '127.0.0.1', 'user_id' => null, 'is_api' => 1, 'requested_at' => now()],
    ]);

    $r = $this->actingAs(monitor_admin(), 'sanctum')
        ->getJson('/api/v1/system-monitor/requests?minutes=30')
        ->assertOk();

    expect($r->json('data.total'))->toBe(3)
        ->and($r->json('data.failed'))->toBe(1)
        ->and($r->json('data.slow_count'))->toBe(1);
});

test('alerts endpoint returns active and recent alerts', function () {
    DB::table('system_alerts')->insert([
        ['type' => 'cpu_high', 'severity' => 'critical', 'message' => 'CPU at 95%', 'context' => null, 'resolved' => 0, 'triggered_at' => now(), 'resolved_at' => null],
        ['type' => 'memory_warn', 'severity' => 'warning', 'message' => 'Memory at 80%', 'context' => null, 'resolved' => 1, 'triggered_at' => now()->subHours(2), 'resolved_at' => now()->subHour()],
    ]);

    $r = $this->actingAs(monitor_admin(), 'sanctum')
        ->getJson('/api/v1/system-monitor/alerts')
        ->assertOk();

    expect(count($r->json('data.active')))->toBe(1)
        ->and(count($r->json('data.recent')))->toBe(1);
});

test('resolve alert marks it resolved', function () {
    $id = DB::table('system_alerts')->insertGetId([
        'type' => 'cpu_warn', 'severity' => 'warning', 'message' => 'test',
        'context' => null, 'resolved' => 0, 'triggered_at' => now(), 'resolved_at' => null,
    ]);

    $this->actingAs(monitor_admin(), 'sanctum')
        ->postJson("/api/v1/system-monitor/alerts/{$id}/resolve")
        ->assertOk();

    expect(DB::table('system_alerts')->where('id', $id)->value('resolved'))->toBe(1);
});
