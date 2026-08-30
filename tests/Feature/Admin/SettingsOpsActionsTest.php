<?php

use App\Models\AppSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// Note: toggle-maintenance and run-backup actually shell out to `artisan up/down`
// and `backup:run` respectively, with real filesystem side effects (maintenance
// mode file, real backup archive) outside the test's DB transaction. Only their
// authorization boundary is exercised here — not the real command execution.

// ─── clear-cache ─────────────────────────────────────────────────────────────

test('a non-super_admin cannot clear the cache', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/clear-cache')
        ->assertStatus(403);
});

test('super_admin can clear the cache', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/settings/clear-cache')
        ->assertOk()
        ->assertJsonPath('message', 'Cache cleared successfully.');
});

// ─── toggle-maintenance ──────────────────────────────────────────────────────

test('a non-super_admin cannot toggle maintenance mode', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/toggle-maintenance')
        ->assertStatus(403);
});

// ─── test-email ──────────────────────────────────────────────────────────────

test('a non-super_admin cannot send a test email', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/test-email')
        ->assertStatus(403);
});

test('super_admin can send a test email', function () {
    Mail::fake();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/settings/test-email', ['to' => 'someone@example.com'])
        ->assertOk()
        ->assertJsonPath('data.recipient', 'someone@example.com');
});

// ─── run-backup ──────────────────────────────────────────────────────────────

test('a non-super_admin cannot trigger a manual backup', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/run-backup')
        ->assertStatus(403);
});

// ─── upload-asset ────────────────────────────────────────────────────────────

test('a plain staff member cannot upload a branding asset', function () {
    Storage::fake('public');
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->postJson('/api/v1/settings/upload-asset', [
            'file' => UploadedFile::fake()->image('logo.png'),
            'key' => 'system_logo',
        ])
        ->assertStatus(403);
});

test('admin can upload a branding asset and it persists as an app setting', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/upload-asset', [
            'file' => UploadedFile::fake()->image('logo.png'),
            'key' => 'system_logo',
        ])
        ->assertOk();

    expect(AppSetting::where('key', 'system_logo')->exists())->toBeTrue();
});

test('upload-asset rejects an unrecognized key', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/upload-asset', [
            'file' => UploadedFile::fake()->image('logo.png'),
            'key' => 'not_a_real_key',
        ])
        ->assertStatus(422);
});

// ─── upload-editor-image ─────────────────────────────────────────────────────

test('a plain staff member cannot upload an editor image', function () {
    Storage::fake('public');
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->postJson('/api/v1/settings/upload-editor-image', ['image' => UploadedFile::fake()->image('pic.png')])
        ->assertStatus(403);
});

test('admin can upload an editor image', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/settings/upload-editor-image', ['image' => UploadedFile::fake()->image('pic.png')])
        ->assertOk();
});
