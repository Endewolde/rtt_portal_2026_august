<?php

use App\Models\AppSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('logging in past the default limit of 1 evicts the previous session and flags it in the response', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123!')]);

    $first = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'Password123!',
    ])->assertOk()
        ->assertJsonPath('data.evicted_session', false)
        ->json('data.token');

    expect($user->tokens()->count())->toBe(1);

    $second = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'Password123!',
    ])->assertOk()
        ->assertJsonPath('data.evicted_session', true)
        ->json('data.token');

    $user->refresh();
    expect($user->tokens()->count())->toBe(1);
    expect($second)->not->toBe($first);

    $this->assertDatabaseHas('audit_logs', [
        'event' => 'user.session_evicted',
        'auditable_id' => $user->id,
    ]);
});

test('raising the limit allows multiple concurrent sessions without eviction', function () {
    AppSetting::where('key', 'max_concurrent_sessions')->update(['value' => '3']);

    $user = User::factory()->create(['password' => bcrypt('Password123!')]);

    foreach (range(1, 3) as $i) {
        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertOk();
    }

    $user->refresh();
    expect($user->tokens()->count())->toBe(3);
});

test('setting the limit to 0 means unlimited concurrent sessions', function () {
    AppSetting::where('key', 'max_concurrent_sessions')->update(['value' => '0']);

    $user = User::factory()->create(['password' => bcrypt('Password123!')]);

    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertOk();
    }

    $user->refresh();
    expect($user->tokens()->count())->toBe(5);
});

test('lowering the concurrent session limit immediately evicts excess existing sessions', function () {
    AppSetting::where('key', 'max_concurrent_sessions')->update(['value' => '2']);

    $admin = User::factory()->create(['password' => bcrypt('Password123!')]);
    $admin->assignRole('super_admin');

    $user = User::factory()->create(['password' => bcrypt('Password123!')]);

    foreach (range(1, 2) as $i) {
        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertOk();
    }

    $user->refresh();
    expect($user->tokens()->count())->toBe(2);

    $this->actingAs($admin)
        ->putJson('/api/v1/settings/app/max_concurrent_sessions', ['value' => '1'])
        ->assertOk();

    $user->refresh();
    expect($user->tokens()->count())->toBe(1);

    $this->assertDatabaseHas('audit_logs', [
        'event' => 'user.session_evicted',
        'auditable_id' => $user->id,
    ]);
});
