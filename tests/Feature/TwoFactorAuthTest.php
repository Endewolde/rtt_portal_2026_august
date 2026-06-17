<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Mail::fake();
});

function tfa_user(bool $enabled = true): User
{
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'status' => 'active',
        'two_factor_enabled' => $enabled,
    ]);
    $user->assignRole('pi');

    return $user;
}

// ── Login flow ──────────────────────────────────────────────────────────────

test('login without 2fa returns token directly', function () {
    $user = tfa_user(false);

    $res = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertOk();

    expect($res->json('data.token'))->not->toBeNull()
        ->and($res->json('data.requires_2fa'))->toBeNull();
});

test('login with 2fa returns requires_2fa and sends email', function () {
    $user = tfa_user(true);

    $res = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertOk();

    expect($res->json('data.requires_2fa'))->toBeTrue()
        ->and($res->json('data.partial_token'))->not->toBeNull()
        ->and($res->json('data.token'))->toBeNull();

    Mail::assertSentCount(1);
});

test('verify 2fa with correct code returns token', function () {
    $user = tfa_user(true);

    $loginRes = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertOk();

    $partialToken = $loginRes->json('data.partial_token');
    $code = Cache::get("2fa_code:{$user->id}");

    $res = $this->postJson('/api/v1/auth/2fa/verify', [
        'partial_token' => $partialToken,
        'code' => $code,
    ])->assertOk();

    expect($res->json('data.token'))->not->toBeNull()
        ->and($res->json('data.user.id'))->toBe($user->id);
});

test('verify 2fa with wrong code returns 422', function () {
    $user = tfa_user(true);

    $loginRes = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertOk();

    $this->postJson('/api/v1/auth/2fa/verify', [
        'partial_token' => $loginRes->json('data.partial_token'),
        'code' => '000000',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.code.0', 'The verification code is incorrect.');
});

test('verify 2fa with expired partial token returns 422', function () {
    $this->postJson('/api/v1/auth/2fa/verify', [
        'partial_token' => (string) Str::uuid(),
        'code' => '123456',
    ])->assertUnprocessable()
        ->assertJsonPath('errors.partial_token.0', 'Verification session expired or invalid. Please sign in again.');
});

test('resend 2fa replaces partial token and sends new email', function () {
    $user = tfa_user(true);

    $loginRes = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertOk();

    $oldPartialToken = $loginRes->json('data.partial_token');

    $resendRes = $this->postJson('/api/v1/auth/2fa/resend', [
        'partial_token' => $oldPartialToken,
    ])->assertOk();

    $newPartialToken = $resendRes->json('data.partial_token');

    expect($newPartialToken)->not->toBe($oldPartialToken);
    expect(Cache::get("2fa_user:{$oldPartialToken}"))->toBeNull();
    expect(Cache::get("2fa_user:{$newPartialToken}"))->toBe($user->id);

    Mail::assertSentCount(2);
});

// ── Toggle ──────────────────────────────────────────────────────────────────

test('authenticated user can enable 2fa', function () {
    $user = tfa_user(false);

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/v1/auth/2fa/toggle', ['enabled' => true])
        ->assertOk()
        ->assertJsonPath('data.two_factor_enabled', true);

    expect($user->fresh()->two_factor_enabled)->toBeTrue();
});

test('authenticated user can disable 2fa', function () {
    $user = tfa_user(true);

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/v1/auth/2fa/toggle', ['enabled' => false])
        ->assertOk()
        ->assertJsonPath('data.two_factor_enabled', false);

    expect($user->fresh()->two_factor_enabled)->toBeFalse();
});

test('unauthenticated user cannot toggle 2fa', function () {
    $this->putJson('/api/v1/auth/2fa/toggle', ['enabled' => true])
        ->assertUnauthorized();
});
