<?php

use App\Models\AppSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

function theme_set(?string $value): void
{
    AppSetting::updateOrCreate(['key' => 'theme'], ['value' => $value, 'type' => 'select', 'group' => 'appearance']);
    Cache::forget('blade_app_meta');
}

test('the chosen theme is applied on every page before it is drawn', function (string $theme) {
    theme_set($theme);

    $this->get('/')->assertOk()->assertSee('var theme = "'.$theme.'"', false);
})->with(['dark', 'system', 'light']);

test('without a theme, or with an unknown one, pages stay light', function (?string $value) {
    theme_set($value);

    $this->get('/')->assertOk()->assertSee('var theme = "light"', false);
})->with([null, 'sepia']);

test('pages still load when the theme setting has never been created', function () {
    AppSetting::where('key', 'theme')->delete();
    Cache::forget('blade_app_meta');

    $this->get('/')->assertOk()->assertSee('var theme = "light"', false);
});
