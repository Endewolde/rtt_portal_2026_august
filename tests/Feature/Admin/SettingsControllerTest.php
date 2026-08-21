<?php

use App\Models\AppSetting;
use App\Models\ThresholdSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    AppSetting::create(['key' => 'blind_threshold', 'value' => '60', 'type' => 'number', 'group' => 'thresholds']);
    ThresholdSetting::create(['key' => 'blind_threshold', 'value' => 60]);
});

test('a negative threshold value is rejected', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/blind_threshold', ['value' => -10]);

    $response->assertStatus(422);
    expect(ThresholdSetting::where('key', 'blind_threshold')->value('value'))->toEqual(60.00);
});

test('a valid threshold value is accepted and synced to threshold_settings', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/blind_threshold', ['value' => 75]);

    $response->assertOk();
    expect(ThresholdSetting::where('key', 'blind_threshold')->value('value'))->toEqual(75.00);
});

test('a threshold value above the allowed range is rejected', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    // blind_threshold is a raw point minimum (not a percentage), so 150 is a
    // perfectly valid value if categories are reconfigured with a higher weight
    // sum — only a wildly out-of-scale value should be rejected.
    $response = $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/blind_threshold', ['value' => 5000]);

    $response->assertStatus(422);
    expect(ThresholdSetting::where('key', 'blind_threshold')->value('value'))->toEqual(60.00);
});

test('a raw point threshold value above 100 is accepted (not treated as a percentage)', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/blind_threshold', ['value' => 150]);

    $response->assertOk();
    expect(ThresholdSetting::where('key', 'blind_threshold')->value('value'))->toEqual(150.00);
});

test('combined_decision_mode only accepts the two known values', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    AppSetting::create(['key' => 'combined_decision_mode', 'value' => 'combined_only', 'type' => 'select', 'group' => 'thresholds']);

    $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/combined_decision_mode', ['value' => 'strict_all'])
        ->assertOk();
    expect(AppSetting::where('key', 'combined_decision_mode')->value('value'))->toBe('strict_all');

    $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/combined_decision_mode', ['value' => 'anything_else'])
        ->assertStatus(422);
    expect(AppSetting::where('key', 'combined_decision_mode')->value('value'))->toBe('strict_all');
});

test('combined_decision_mode is not synced into the numeric threshold_settings table', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    AppSetting::create(['key' => 'combined_decision_mode', 'value' => 'combined_only', 'type' => 'select', 'group' => 'thresholds']);

    $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/combined_decision_mode', ['value' => 'strict_all'])
        ->assertOk();

    expect(ThresholdSetting::where('key', 'combined_decision_mode')->exists())->toBeFalse();
});
