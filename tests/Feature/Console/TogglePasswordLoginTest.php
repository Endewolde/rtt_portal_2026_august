<?php

use App\Models\AppSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('disable sets password_login_enabled to false', function () {
    Artisan::call('auth:password-login', ['action' => 'disable']);

    expect(AppSetting::where('key', 'password_login_enabled')->value('value'))->toBe('false');
});

test('enable sets password_login_enabled to true', function () {
    AppSetting::updateOrCreate(['key' => 'password_login_enabled'], ['value' => 'false']);

    Artisan::call('auth:password-login', ['action' => 'enable']);

    expect(AppSetting::where('key', 'password_login_enabled')->value('value'))->toBe('true');
});

test('status reports the current state without changing it', function () {
    AppSetting::updateOrCreate(['key' => 'password_login_enabled'], ['value' => 'false']);

    $exitCode = Artisan::call('auth:password-login', ['action' => 'status']);

    expect($exitCode)->toBe(0)
        ->and(Artisan::output())->toContain('disabled')
        ->and(AppSetting::where('key', 'password_login_enabled')->value('value'))->toBe('false');
});

test('an unknown action fails without changing the setting', function () {
    $before = AppSetting::where('key', 'password_login_enabled')->value('value');

    $exitCode = Artisan::call('auth:password-login', ['action' => 'nonsense']);

    expect($exitCode)->toBe(1)
        ->and(AppSetting::where('key', 'password_login_enabled')->value('value'))->toBe($before);
});

// ─── Enforcement: disabling actually blocks the login endpoint ─────────────

test('disabling password login blocks a plain user from logging in with a password', function () {
    $user = User::factory()->create(['password' => Hash::make('correct-password'), 'email_verified_at' => now()]);
    $user->assignRole('staff');

    Artisan::call('auth:password-login', ['action' => 'disable']);

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'correct-password',
    ])->assertStatus(422);
});

test('super_admin can still log in with a password when password login is disabled', function () {
    $admin = User::factory()->create(['password' => Hash::make('correct-password'), 'email_verified_at' => now()]);
    $admin->assignRole('super_admin');

    Artisan::call('auth:password-login', ['action' => 'disable']);

    $this->postJson('/api/v1/auth/login', [
        'email' => $admin->email,
        'password' => 'correct-password',
    ])->assertOk();
});

test('password login works normally when not disabled', function () {
    $user = User::factory()->create(['password' => Hash::make('correct-password'), 'email_verified_at' => now()]);
    $user->assignRole('staff');

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'correct-password',
    ])->assertOk();
});
