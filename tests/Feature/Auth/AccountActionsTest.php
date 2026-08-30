<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── change-password ─────────────────────────────────────────────────────────

test('changing password requires the correct current password', function () {
    $user = User::factory()->create(['password' => Hash::make('correct-password')]);
    $user->assignRole('staff');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/change-password', [
            'current_password' => 'wrong-password',
            'password' => 'brand-new-password',
            'password_confirmation' => 'brand-new-password',
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.current_password.0', 'Current password is incorrect.');

    expect(Hash::check('correct-password', $user->fresh()->password))->toBeTrue();
});

test('changing password with the correct current password rotates credentials', function () {
    $user = User::factory()->create(['password' => Hash::make('correct-password')]);
    $user->assignRole('staff');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/change-password', [
            'current_password' => 'correct-password',
            'password' => 'brand-new-password',
            'password_confirmation' => 'brand-new-password',
        ])
        ->assertOk();

    expect(Hash::check('brand-new-password', $user->fresh()->password))->toBeTrue()
        ->and(Hash::check('correct-password', $user->fresh()->password))->toBeFalse();
});

test('changing password requires password confirmation to match', function () {
    $user = User::factory()->create(['password' => Hash::make('correct-password')]);
    $user->assignRole('staff');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/change-password', [
            'current_password' => 'correct-password',
            'password' => 'brand-new-password',
            'password_confirmation' => 'does-not-match',
        ])
        ->assertStatus(422);
});

// ─── avatar upload ───────────────────────────────────────────────────────────

test('a user can upload their own avatar', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $user->assignRole('staff');

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/avatar', ['avatar' => UploadedFile::fake()->image('me.jpg')])
        ->assertOk();

    expect($user->fresh()->avatar)->not->toBeNull()
        ->and($response->json('data.url'))->toBe($user->fresh()->avatar);
});

test('avatar upload rejects a non-image file', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $user->assignRole('staff');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/avatar', ['avatar' => UploadedFile::fake()->create('resume.pdf', 100)])
        ->assertStatus(422);
});

// ─── resend-verification ─────────────────────────────────────────────────────

test('resend-verification does not reveal whether the email exists', function () {
    $responseKnown = $this->postJson('/api/v1/auth/resend-verification', ['email' => 'nobody@example.com']);
    $responseUnknown = $this->postJson('/api/v1/auth/resend-verification', ['email' => 'also-nobody@example.com']);

    expect($responseKnown->json('message'))->toBe($responseUnknown->json('message'));
    $responseKnown->assertOk();
});

test('resend-verification is a no-op for an already-verified account', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $user->assignRole('staff');

    $this->postJson('/api/v1/auth/resend-verification', ['email' => $user->email])
        ->assertOk();
});
