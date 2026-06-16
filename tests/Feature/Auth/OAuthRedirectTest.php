<?php

use App\Models\AppSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;

uses(RefreshDatabase::class);

test('the microsoft oauth redirect forces the account picker so a previous account is not reused', function () {
    AppSetting::create(['key' => 'microsoft_sso_enabled', 'value' => 'true', 'type' => 'boolean', 'group' => 'security']);

    $provider = Mockery::mock(AbstractProvider::class);
    $provider->shouldReceive('scopes')->once()->andReturnSelf();
    $provider->shouldReceive('with')->once()->with(['prompt' => 'select_account'])->andReturnSelf();
    $provider->shouldReceive('redirect')->once()->andReturn(redirect('https://login.microsoftonline.com/fake-authorize'));

    Socialite::shouldReceive('driver')->with('azure')->once()->andReturn($provider);

    $response = $this->get('/auth/oauth/microsoft');

    $response->assertRedirect('https://login.microsoftonline.com/fake-authorize');
});
