<?php

use App\Models\AppSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('unauthenticated user cannot trigger manual backup', function () {
    $response = $this->postJson('/api/v1/settings/run-backup');

    $response->assertStatus(401);
});

test('non-super-admin cannot trigger manual backup', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');

    $response = $this->actingAs($user)->postJson('/api/v1/settings/run-backup');

    $response->assertStatus(403);
});

test('super admin can trigger manual backup and receives success response', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    Artisan::shouldReceive('call')
        ->with('backup:run')
        ->once()
        ->andReturn(0);

    Artisan::shouldReceive('output')
        ->once()
        ->andReturn('[Backup] ✓ rtt_backup_2026-06-10.sql.gz (1.2 MB)');

    $response = $this->actingAs($admin)->postJson('/api/v1/settings/run-backup');

    $response->assertStatus(200)
        ->assertJsonPath('message', 'Backup completed successfully.');
});

test('backup settings are seeded in the database', function () {
    $keys = [
        'auto_backup_enabled',
        'backup_schedule',
        'backup_retention_days',
        'backup_notify_email',
        'backup_notify_telegram',
        'backup_email_recipient',
        'backup_telegram_chat_id',
    ];

    foreach ($keys as $key) {
        expect(AppSetting::where('key', $key)->exists())->toBeTrue("Missing setting: {$key}");
    }
});
