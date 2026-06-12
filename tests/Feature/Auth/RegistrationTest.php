<?php

use App\Models\AuditLog;
use App\Models\NotificationPreference;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('user can register with valid data', function () {
    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertCreated()
        ->assertJsonPath('message', 'Registration successful. Please check your email to verify your account.')
        ->assertJsonStructure(['data' => ['user']]);

    $this->assertDatabaseHas('users', ['email' => 'jane@example.com']);
});

test('registered user is assigned guest role automatically', function () {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ])->assertCreated();

    $user = User::where('email', 'jane@example.com')->first();
    expect($user->hasRole('guest'))->toBeTrue();
});

test('registered user has notification_preferences row created', function () {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ])->assertCreated();

    $user = User::where('email', 'jane@example.com')->first();

    expect(NotificationPreference::where('user_id', $user->id)->exists())->toBeTrue();
});

test('registration is logged in audit_logs', function () {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ])->assertCreated();

    $user = User::where('email', 'jane@example.com')->first();

    expect(
        AuditLog::where('auditable_id', $user->id)
            ->where('event', 'user.registered')
            ->exists()
    )->toBeTrue();
});

test('cannot register with duplicate email', function () {
    User::factory()->create(['email' => 'existing@example.com']);

    $this->postJson('/api/v1/auth/register', [
        'name' => 'Another User',
        'email' => 'existing@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ])->assertUnprocessable();
});

test('cannot register with password shorter than 8 characters', function () {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'short',
        'password_confirmation' => 'short',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.password.0', fn ($msg) => str_contains($msg, '8'));
});
