<?php

use App\Models\AppSetting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(fn () => (new RolePermissionSeeder)->run());

function pps_set(string $key, ?string $value): void
{
    AppSetting::updateOrCreate(['key' => $key], ['value' => $value]);
    Cache::forget('public_closed_pages');
}

test('a public menu item switched off closes its page and the pages under it, even by typed address', function () {
    $this->get('/conferences')->assertOk();

    pps_set('public_nav_item_3_show', 'false');

    $this->get('/conferences')->assertNotFound()->assertSee('Public\/PageUnavailable', false);
    $this->get('/conferences/research-week')->assertNotFound();
    $this->get('/explore')->assertOk();
    // A path that merely starts the same way is a different page.
    $this->get('/conferences-archive')->assertStatus(404)->assertDontSee('Public\/PageUnavailable', false);

    pps_set('public_nav_item_3_show', 'true');
    $this->get('/conferences')->assertOk();
});

test('an edited menu link closes the page it points to, and home never closes', function () {
    pps_set('public_nav_item_4_href', '/repository');
    pps_set('public_nav_item_4_show', 'false');
    pps_set('public_nav_item_1_show', 'false');

    $this->get('/repository')->assertNotFound();
    $this->get('/explore')->assertOk();
    $this->get('/')->assertOk();
});

test('saving the public site settings takes effect straight away', function () {
    $this->get('/tracker')->assertOk();
    $this->actingAs(User::factory()->create()->assignRole('super_admin'), 'sanctum')
        ->putJson('/api/v1/settings/public-site', ['settings' => ['public_nav_item_7_show' => 'false']])->assertOk();

    $this->get('/tracker')->assertNotFound();
});
