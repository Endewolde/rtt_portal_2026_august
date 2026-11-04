<?php

use App\Models\User;
use Database\Seeders\AppSettingsSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

test('a fresh install\'s footer keeps its year current by itself', function () {
    DB::table('app_settings')->where('key', 'footer_text')->delete();

    (new AppSettingsSeeder)->run();

    expect(DB::table('app_settings')->where('key', 'footer_text')->value('value'))->toBe('© {year} {system}. All rights reserved.');
});

test('footer placeholders are saved as typed and reach every page for the layout to fill in', function () {
    (new RolePermissionSeeder)->run();
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/settings/app/footer_text', ['value' => '© {year} {org} · {system}'])
        ->assertOk();

    $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->where('app_settings.footer_text', '© {year} {org} · {system}'));
});
