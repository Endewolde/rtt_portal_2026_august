<?php

use App\Models\User;
use App\Services\AuthService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('generateTelegramLinkToken creates token with 10-minute expiry', function () {
    $authService = app(AuthService::class);
    $user        = User::factory()->create();

    $token = $authService->generateTelegramLinkToken($user);
    $user->refresh();

    expect($user->telegram_link_token)->toBe($token)
        ->and($user->telegram_link_token)->toHaveLength(32)
        ->and($user->telegram_link_token_expires_at)->not->toBeNull()
        ->and($user->telegram_link_token_expires_at->diffInMinutes(now()))->toBeLessThanOrEqual(10);
});

test('valid token links telegram_chat_id to user', function () {
    $authService = app(AuthService::class);
    $user        = User::factory()->create();
    $token       = $authService->generateTelegramLinkToken($user);

    $linked = $authService->linkTelegramAccount($token, '123456789');

    expect($linked->telegram_chat_id)->toBe('123456789');
});

test('expired token cannot be used', function () {
    User::factory()->create([
        'telegram_link_token'            => 'expiredtoken123456789012345678901',
        'telegram_link_token_expires_at' => now()->subMinute(),
    ]);

    expect(fn () => app(AuthService::class)->linkTelegramAccount('expiredtoken123456789012345678901', '123456789'))
        ->toThrow(\Exception::class, 'Invalid or expired');
});

test('used token is cleared after successful link', function () {
    $authService = app(AuthService::class);
    $user        = User::factory()->create();
    $token       = $authService->generateTelegramLinkToken($user);

    $authService->linkTelegramAccount($token, '999888777');
    $user->refresh();

    expect($user->telegram_link_token)->toBeNull()
        ->and($user->telegram_link_token_expires_at)->toBeNull();
});
