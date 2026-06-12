<?php

use App\Models\User;
use App\Services\DashboardService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

test('dashboard cache key format is dashboard:{user_id}', function () {
    $user = User::factory()->create(['status' => 'active', 'email_verified_at' => now()]);
    $user->assignRole('pi');

    $expectedKey = "dashboard:{$user->id}";
    $captured    = null;

    Cache::shouldReceive('remember')
        ->once()
        ->withArgs(function ($key) use ($expectedKey, &$captured) {
            $captured = $key;
            return $key === $expectedKey;
        })
        ->andReturn([]);

    app(DashboardService::class)->getWidgets($user);

    expect($captured)->toBe($expectedKey);
});

test('cache is invalidated when DashboardService::invalidate is called', function () {
    $user = User::factory()->create(['status' => 'active', 'email_verified_at' => now()]);
    $user->assignRole('pi');

    Cache::shouldReceive('forget')
        ->once()
        ->with("dashboard:{$user->id}");

    app(DashboardService::class)->invalidate($user->id);
});

test('dashboard served from cache on second request', function () {
    $user = User::factory()->create(['status' => 'active', 'email_verified_at' => now()]);
    $user->assignRole('pi');

    $service = app(DashboardService::class);

    // First call populates cache
    $first = $service->getWidgets($user);

    // Second call should return same data (from cache)
    $second = $service->getWidgets($user);

    expect($second)->toBe($first);
});
