<?php

use App\Models\AppSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
});

test('the public site editor saves many settings at once, creating missing ones', function () {
    $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/settings/public-site', ['settings' => [
        'public_header_subtitle' => 'Research Office',
        'public_nav_item_7_label' => 'Track',
        'public_nav_item_8_show' => 'false',
        'slider_slide_count' => '5',
        'slider_slide_5_color' => '#ef4444',
        'public_feature_3_show' => 'false',
        'public_social_telegram' => 'https://t.me/research',
    ]])->assertOk()->assertJsonPath('data.saved', 7);

    expect(AppSetting::where('key', 'public_nav_item_7_label')->value('value'))->toBe('Track')
        ->and(AppSetting::where('key', 'slider_slide_5_color')->value('value'))->toBe('#ef4444')
        ->and(AppSetting::where('key', 'public_feature_3_show')->value('type'))->toBe('boolean');
});

test('bad values are refused with the reason, and nothing is saved', function () {
    $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/settings/public-site', ['settings' => [
        'public_header_subtitle' => 'Fine',
        'public_hero_bg' => 'blue',
        'public_nav_item_2_href' => 'javascript:alert(1)',
        'public_social_facebook' => 'facebook.com/x',
        'slider_slide_count' => '9',
        'mail_password' => 'nope',
    ]])->assertUnprocessable()
        ->assertJsonValidationErrors(['public_hero_bg', 'public_nav_item_2_href', 'public_social_facebook', 'slider_slide_count', 'mail_password']);

    expect(AppSetting::where('key', 'public_header_subtitle')->exists())->toBeFalse();
});

test('all eight public menu items reach the public pages', function () {
    AppSetting::create(['key' => 'public_nav_item_8_label', 'value' => 'Our Researchers', 'type' => 'string', 'group' => 'public_site']);

    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page->where('app_settings.public_nav_item_8_label', 'Our Researchers'));
});

test('only settings managers can save the public site', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')->putJson('/api/v1/settings/public-site', ['settings' => ['public_cta_title' => 'x']])->assertForbidden();
});
