<?php

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('user can login with correct credentials', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123!')]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'Password123!',
    ])->assertOk()
        ->assertJsonPath('message', 'Login successful.')
        ->assertJsonStructure(['data' => ['user', 'token']]);
});

test('login returns token in response', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123!')]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'Password123!',
    ])->assertOk();

    $token = $response->json('data.token');
    expect($token)->toBeString()->not->toBeEmpty();
});

test('login is logged in audit_logs', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123!')]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'Password123!',
    ])->assertOk();

    expect(
        AuditLog::where('auditable_id', $user->id)
            ->where('event', 'user.login')
            ->exists()
    )->toBeTrue();
});

test('cannot login with wrong password', function () {
    $user = User::factory()->create(['password' => bcrypt('CorrectPassword!')]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'WrongPassword!',
    ])->assertUnprocessable();
});

test('inactive user cannot login', function () {
    $user = User::factory()->create([
        'password' => bcrypt('Password123!'),
        'status'   => 'inactive',
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'Password123!',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.email.0', fn ($msg) => str_contains($msg, 'not active'));
});
