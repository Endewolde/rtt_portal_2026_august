<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function alt_user(): User
{
    $user = User::factory()->create(['password' => Hash::make('correct-password'), 'email_verified_at' => now()]);
    $user->assignRole('staff');

    return $user;
}

test('a few wrong passwords do not lock the account', function () {
    $user = alt_user();

    for ($i = 0; $i < 4; $i++) {
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertStatus(422);
    }

    expect($user->fresh()->locked_until)->toBeNull();

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'correct-password'])
        ->assertOk();
});

test('the 5th consecutive wrong password locks the account', function () {
    $user = alt_user();

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertStatus(422);
    }

    expect($user->fresh()->locked_until)->not->toBeNull()
        ->and($user->fresh()->locked_until->isFuture())->toBeTrue();
});

test('a correct password is rejected while the account is locked', function () {
    $user = alt_user();

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertStatus(422);
    }

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'correct-password'])
        ->assertStatus(422)
        ->assertJsonPath('errors.email.0', fn ($msg) => str_contains($msg, 'Too many failed login attempts'));
});

test('a successful login resets the failed-attempt counter', function () {
    $user = alt_user();

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertStatus(422);
    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertStatus(422);
    expect($user->fresh()->failed_login_attempts)->toBe(2);

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'correct-password'])->assertOk();

    expect($user->fresh()->failed_login_attempts)->toBe(0)
        ->and($user->fresh()->locked_until)->toBeNull();
});

test('after the lockout window passes, login works again', function () {
    $user = alt_user();

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertStatus(422);
    }

    // Simulate the lockout window having already elapsed.
    $user->forceFill(['locked_until' => now()->subMinute()])->save();

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'correct-password'])
        ->assertOk();

    expect($user->fresh()->failed_login_attempts)->toBe(0);
});

test('lockout is scoped to the account being attacked — an unrelated account is unaffected', function () {
    $victim = alt_user();
    $bystander = alt_user();

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', ['email' => $victim->email, 'password' => 'wrong'])->assertStatus(422);
    }

    $this->postJson('/api/v1/auth/login', ['email' => $bystander->email, 'password' => 'correct-password'])
        ->assertOk();
});
