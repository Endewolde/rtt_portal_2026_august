<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('a user can list their own sessions and the current one is flagged', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');
    $token = $user->createToken('auth_token')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/auth/sessions')
        ->assertOk();

    $sessions = $response->json('data');
    expect($sessions)->toHaveCount(1)
        ->and($sessions[0]['is_current'])->toBeTrue();
});

test('multiple sessions are listed and only the requesting one is current', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');
    $user->createToken('old_device');
    $newToken = $user->createToken('new_device')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$newToken}")
        ->getJson('/api/v1/auth/sessions')
        ->assertOk();

    $sessions = collect($response->json('data'));
    expect($sessions)->toHaveCount(2)
        ->and($sessions->where('is_current', true))->toHaveCount(1);
});

test('a user can revoke one of their own sessions', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');
    $oldAccessToken = $user->createToken('old_device');
    $newToken = $user->createToken('new_device')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$newToken}")
        ->deleteJson("/api/v1/auth/sessions/{$oldAccessToken->accessToken->id}")
        ->assertOk();

    expect($user->tokens()->count())->toBe(1);
});

test('revoking your current session logs you out', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');
    $accessToken = $user->createToken('this_device');
    $token = $accessToken->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$token}")
        ->deleteJson("/api/v1/auth/sessions/{$accessToken->accessToken->id}")
        ->assertOk();

    // See SanityTokenTest.php — Sanctum's RequestGuard caches its resolved user
    // within a single test method's app instance, which real, separate HTTP
    // requests never do.
    $this->refreshApplication();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/auth/me')
        ->assertStatus(401);
});

test('an impersonation token is excluded from the sessions list', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');
    $user->createToken('impersonation_token');
    $token = $user->createToken('auth_token')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/auth/sessions')
        ->assertOk();

    $sessions = collect($response->json('data'));
    expect($sessions)->toHaveCount(1)
        ->and($sessions->pluck('name'))->not->toContain('impersonation_token');
});

test('a user cannot revoke another user\'s session', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');
    $userToken = $user->createToken('auth_token')->plainTextToken;

    $otherUser = User::factory()->create();
    $otherUser->assignRole('staff');
    $otherAccessToken = $otherUser->createToken('auth_token');

    $this->withHeader('Authorization', "Bearer {$userToken}")
        ->deleteJson("/api/v1/auth/sessions/{$otherAccessToken->accessToken->id}")
        ->assertStatus(404);

    expect($otherUser->tokens()->count())->toBe(1);
});
