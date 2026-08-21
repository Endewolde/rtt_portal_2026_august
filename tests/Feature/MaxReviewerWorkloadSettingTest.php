<?php

use App\Models\AppSetting;
use App\Models\ThresholdSetting;
use App\Models\User;
use Database\Seeders\AppSettingsSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new ThresholdSettingSeeder)->run();
    (new AppSettingsSeeder)->run();
});

test('max_reviewer_active_assignments appears in the thresholds group for the Settings page', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/settings/app');

    $response->assertOk();
    expect($response->json('data.thresholds.max_reviewer_active_assignments.value'))->toBe('5');
});

test('updating the setting through the admin UI endpoint syncs to threshold_settings', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/max_reviewer_active_assignments', ['value' => '8'])
        ->assertOk();

    expect(AppSetting::where('key', 'max_reviewer_active_assignments')->value('value'))->toBe('8')
        ->and((float) ThresholdSetting::where('key', 'max_reviewer_active_assignments')->value('value'))->toBe(8.0);
});
