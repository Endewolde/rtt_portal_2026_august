<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\MaintenanceModeBypassCookie;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

/** Switch maintenance on (tests keep it in memory) and return a browser cookie from the access link. */
function maint_on(): string
{
    $secret = 'rtt-bypass-'.str_repeat('a', 32);
    app()->maintenanceMode()->activate(['secret' => $secret, 'except' => [], 'template' => null, 'status' => 503, 'retry' => null, 'refresh' => null, 'redirect' => null]);

    return MaintenanceModeBypassCookie::create($secret)->getValue();
}

test('an administrator with the access link can use the system during maintenance', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $cookie = maint_on();

    $this->withCredentials()->withUnencryptedCookie('laravel_maintenance', $cookie)
        ->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/auth/me')
        ->assertOk();
});

test('anyone else with the access link still gets the maintenance reply', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $cookie = maint_on();

    $this->withCredentials()->withUnencryptedCookie('laravel_maintenance', $cookie)
        ->actingAs($staff, 'sanctum')
        ->getJson('/api/v1/auth/me')
        ->assertStatus(503)
        ->assertJsonPath('meta.maintenance', true);
});

test('signing in stays open during maintenance so an administrator can log in', function () {
    $admin = User::factory()->create(['email' => 'admin@wsu.edu.et', 'password' => bcrypt('Secret-pass-123'), 'status' => 'active']);
    $admin->assignRole('admin');
    $cookie = maint_on();

    $response = $this->withCredentials()->withUnencryptedCookie('laravel_maintenance', $cookie)
        ->postJson('/api/v1/auth/login', ['email' => 'admin@wsu.edu.et', 'password' => 'Secret-pass-123']);

    expect($response->status())->not->toBe(503);
});

test('outside maintenance nobody is affected', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')->getJson('/api/v1/auth/me')->assertOk();
});
