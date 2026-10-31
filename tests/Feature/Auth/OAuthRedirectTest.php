<?php

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request as PsrRequest;
use GuzzleHttp\Psr7\Response as PsrResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Sleep;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\User as SocialUser;

uses(RefreshDatabase::class);

beforeEach(function () {
    AppSetting::create(['key' => 'microsoft_sso_enabled', 'value' => 'true', 'type' => 'boolean', 'group' => 'security']);
});

/** Starts a sign-in and returns the state the provider would send back. */
function oauth_start(): string
{
    $state = null;
    $provider = Mockery::mock(AbstractProvider::class);
    $provider->shouldReceive('stateless')->andReturnSelf();
    $provider->shouldReceive('scopes')->andReturnSelf();
    $provider->shouldReceive('with')->once()->withArgs(function (array $params) use (&$state) {
        $state = $params['state'] ?? null;

        return ($params['prompt'] ?? null) === 'select_account' && is_string($state) && strlen($state) === 40;
    })->andReturnSelf();
    $provider->shouldReceive('redirect')->once()->andReturn(redirect('https://login.microsoftonline.com/fake-authorize'));
    Socialite::shouldReceive('driver')->with('azure')->once()->andReturn($provider);

    test()->get('/auth/oauth/microsoft')->assertRedirect('https://login.microsoftonline.com/fake-authorize');

    return $state;
}

function oauth_provider_returning(Closure $user): void
{
    $provider = Mockery::mock(AbstractProvider::class);
    $provider->shouldReceive('stateless')->andReturnSelf();
    $provider->shouldReceive('setHttpClient')->andReturnSelf();
    $provider->shouldReceive('user')->andReturnUsing($user);
    Socialite::shouldReceive('driver')->with('azure')->andReturn($provider);
}

function oauth_social_user(string $email): SocialUser
{
    return (new SocialUser)->map(['id' => 'ms-1', 'name' => 'Tekalgn Balcha', 'email' => $email]);
}

test('the redirect forces the account picker and keeps the state on the server, not in the session cookie', function () {
    $state = oauth_start();

    expect(Cache::get('oauth-state:'.$state))->toBe('microsoft');
});

test('the callback works without the session that started it — as when a phone returns in another browser context', function () {
    (new RolePermissionSeeder)->run();
    User::factory()->create(['email' => 'tekalgn@wsu.edu.et', 'status' => 'active']);
    $state = oauth_start();

    // A fresh session, as in the installed app or a different browser window.
    $this->flushSession();
    oauth_provider_returning(fn () => oauth_social_user('tekalgn@wsu.edu.et'));

    $this->get("/auth/oauth/microsoft/callback?code=abc&state={$state}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Auth/OAuthSuccess')->has('token'));

    // The same callback again (reload, prefetch) gets the same result rather than "Authentication failed".
    $this->get("/auth/oauth/microsoft/callback?code=abc&state={$state}")->assertOk()
        ->assertInertia(fn ($page) => $page->component('Auth/OAuthSuccess'));
});

test('an unknown or reused state is refused with a clear message and recorded', function () {
    $this->get('/auth/oauth/microsoft/callback?code=abc&state=forged')
        ->assertRedirect('/login?sso_error='.urlencode('That sign-in link has expired. Please tap "Continue" again.'));

    expect(AuditLog::where('event', 'user.login_failed')->first()->new_values['reason'])->toBe('Missing or expired sign-in state');
});

test('a dropped connection to Microsoft is retried once before giving up', function () {
    (new RolePermissionSeeder)->run();
    User::factory()->create(['email' => 'tekalgn@wsu.edu.et', 'status' => 'active']);
    $state = oauth_start();

    $calls = 0;
    oauth_provider_returning(function () use (&$calls) {
        if (++$calls === 1) {
            throw new ConnectException('cURL error 28: Connection timed out', new PsrRequest('POST', 'https://login.microsoftonline.com/token'));
        }

        return oauth_social_user('tekalgn@wsu.edu.et');
    });

    $this->get("/auth/oauth/microsoft/callback?code=xyz&state={$state}")->assertOk()
        ->assertInertia(fn ($page) => $page->component('Auth/OAuthSuccess'));
    expect($calls)->toBe(2);
});

test('cancelling on the Microsoft screen explains itself', function () {
    $this->get('/auth/oauth/microsoft/callback?error=access_denied&error_description=User+cancelled')
        ->assertRedirect('/login?sso_error='.urlencode('Sign-in was cancelled. Choose your account to continue.'));
});

test('a callback arriving while another is redeeming the same code waits for it instead of redeeming it again', function () {
    $state = oauth_start();
    Cache::add('oauth-claim:'.hash('sha256', 'dup'), true, 60); // the first callback is talking to Microsoft

    $provider = Mockery::mock(AbstractProvider::class);
    $provider->shouldNotReceive('user');
    Socialite::shouldReceive('driver')->andReturn($provider);

    Sleep::fake(syncWithCarbon: true);
    Sleep::whenFakingSleep(fn () => Cache::put('oauth-done:'.hash('sha256', 'dup'), ['token' => 't-1', 'user' => ['id' => 'u-1']], 120));

    $this->get("/auth/oauth/microsoft/callback?code=dup&state={$state}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Auth/OAuthSuccess')->where('token', 't-1'));
    expect(Cache::get('oauth-state:'.$state))->toBe('microsoft'); // left for the callback that holds the claim
});

test('a duplicate callback whose twin never finishes gives up with a clear message', function () {
    Cache::add('oauth-claim:'.hash('sha256', 'stuck'), true, 60);
    Sleep::fake(syncWithCarbon: true);

    $this->get('/auth/oauth/microsoft/callback?code=stuck&state=whatever')
        ->assertRedirect('/login?sso_error='.urlencode('This sign-in was already used. Please tap "Continue" again.'));
});

test('Microsoft saying the code was already redeemed (AADSTS54005) is not reported as a failed sign-in', function () {
    $state = oauth_start();
    Sleep::fake(syncWithCarbon: true);
    oauth_provider_returning(fn () => throw new ClientException(
        'Client error: 400 Bad Request',
        new PsrRequest('POST', 'https://login.microsoftonline.com/token'),
        new PsrResponse(400, [], '{"error":"invalid_grant","error_description":"AADSTS54005: OAuth2 Authorization code was already redeemed"}'),
    ));

    $this->get("/auth/oauth/microsoft/callback?code=used&state={$state}")
        ->assertRedirect('/login?sso_error='.urlencode('This sign-in was already used. Please tap "Continue" again.'));
    expect(AuditLog::where('event', 'user.login_failed')->exists())->toBeFalse();
});
