<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

test('the app manifest uses the system name and offers home-screen icons', function () {
    DB::table('app_settings')->insert(['id' => (string) Str::uuid(), 'key' => 'system_name', 'value' => 'RTT', 'type' => 'string', 'group' => 'general']);

    $this->get('/manifest.webmanifest')
        ->assertOk()
        ->assertJsonPath('short_name', 'RTT')
        ->assertJsonPath('display', 'standalone')
        ->assertJsonPath('icons.0.src', '/pwa-icon/192.png');
});

test('icons are generated as PNG at the supported sizes only', function () {
    $response = $this->get('/pwa-icon/192.png')->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('image/png')
        ->and(getimagesizefromstring($response->getContent())[0])->toBe(192);

    $this->get('/pwa-icon/64.png')->assertNotFound();
});
