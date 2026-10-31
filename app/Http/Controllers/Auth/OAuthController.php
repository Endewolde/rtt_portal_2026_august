<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\User;
use App\Support\AuditLogger;
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Exception\ConnectException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Socialite\Facades\Socialite;
use Spatie\Permission\Models\Role;

class OAuthController extends Controller
{
    private const SUPPORTED = ['google', 'microsoft'];

    private const STATE_KEY = 'oauth-state:';

    /** How long someone may take on the provider's sign-in screen. */
    private const STATE_MINUTES = 15;

    /** A repeated callback (reload, prefetch) gets the same result instead of an error. */
    private const DONE_KEY = 'oauth-done:';

    /** Held by the one request allowed to redeem a code; Microsoft accepts each code only once. */
    private const CLAIM_KEY = 'oauth-claim:';

    /** Longest a duplicate callback waits for the request that holds the claim (its token call may take up to 25s). */
    private const AWAIT_SECONDS = 30;

    public function redirect(string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, self::SUPPORTED), 404);
        abort_unless(AppSetting::where('key', "{$provider}_sso_enabled")->value('value') === 'true', 403, 'SSO is not enabled for this provider.');

        $this->applyProviderConfig($provider);

        // The anti-forgery "state" is kept on the server, not in the session cookie. On
        // phones (and in the installed app) the provider often returns to a browser context
        // without that cookie, which made sign-in fail until a lucky retry.
        $state = Str::random(40);
        Cache::put(self::STATE_KEY.$state, $provider, now()->addMinutes(self::STATE_MINUTES));

        return Socialite::driver($this->driverName($provider))
            ->stateless()
            ->scopes($this->scopes($provider))
            ->with(['prompt' => 'select_account', 'state' => $state])
            ->redirect();
    }

    public function callback(string $provider): Response|RedirectResponse
    {
        abort_unless(in_array($provider, self::SUPPORTED), 404);
        abort_unless(AppSetting::where('key', "{$provider}_sso_enabled")->value('value') === 'true', 403, 'SSO is not enabled for this provider.');

        $this->applyProviderConfig($provider);

        // The person cancelled or the provider refused (e.g. account not allowed in the tenant).
        if ($error = request()->query('error')) {
            $this->auditFailure($provider, 'Provider returned: '.$error.' '.request()->query('error_description'));

            return $this->fail($error === 'access_denied'
                ? 'Sign-in was cancelled. Choose your account to continue.'
                : 'Microsoft could not sign you in ('.Str::limit((string) request()->query('error_description', $error), 120).').');
        }

        $code = (string) request()->query('code');
        $doneKey = self::DONE_KEY.hash('sha256', $code);
        if ($code !== '' && ($done = Cache::get($doneKey))) {
            return Inertia::render('Auth/OAuthSuccess', $done);
        }

        // Two callbacks with the same code can arrive at once (prefetch plus the real visit,
        // a double tap, the browser handing over to the installed app). Only the first may
        // redeem it — a second redemption fails with AADSTS54005 and showed "Authentication
        // failed" to someone who was in fact signed in — so the other waits for its result.
        if ($code !== '' && ! Cache::add(self::CLAIM_KEY.hash('sha256', $code), true, now()->addSeconds(self::AWAIT_SECONDS * 2))) {
            return $this->awaitOtherCallback($doneKey);
        }

        $state = (string) request()->query('state');
        if ($state === '' || Cache::pull(self::STATE_KEY.$state) !== $provider) {
            $this->auditFailure($provider, 'Missing or expired sign-in state');

            return $this->fail('That sign-in link has expired. Please tap "Continue" again.');
        }

        try {
            $socialUser = $this->fetchUser($provider);
        } catch (\Throwable $e) {
            if ($this->isCodeAlreadyRedeemed($e)) {
                return $this->awaitOtherCallback($doneKey);
            }

            Log::warning("[SSO] OAuth callback failed for {$provider}: ".get_class($e).': '.$e->getMessage());
            $this->auditFailure($provider, Str::limit(get_class($e).': '.$e->getMessage(), 250));

            return $this->fail($this->isNetworkProblem($e)
                ? 'We could not reach Microsoft in time. Please check your connection and try again.'
                : 'Authentication failed. Please try again.');
        }

        $email = $socialUser->getEmail();

        if (! $email) {
            return redirect('/login?sso_error='.urlencode('No email address returned by the provider.'));
        }

        $oauthId = (string) $socialUser->getId();
        $existingUser = User::where('oauth_provider', $provider)->where('oauth_id', $oauthId)->first()
            ?? User::where('email', $email)->first();

        if (! $existingUser && AppSetting::where('key', 'self_registration')->value('value') === 'false') {
            return redirect('/login?sso_error='.urlencode('Your account ('.$email.') is not registered in this system. Please contact the administrator to create your account before signing in with SSO.'));
        }

        if (! $existingUser && AppSetting::where('key', 'sso_allow_registration')->value('value') !== 'true') {
            return redirect('/register?sso_notice='.urlencode('You don\'t have an account yet. Please complete the registration form to create one — SSO can then be used to sign in.'));
        }

        $user = $this->findOrCreateUser($provider, $socialUser);

        if ($user->status !== 'active') {
            return redirect('/login?sso_error='.urlencode('Your account has been deactivated. Please contact an administrator.'));
        }

        $user->update([
            'last_login_at' => now(),
            'first_login_at' => $user->first_login_at ?? now(),
        ]);

        $token = $user->createToken('sso_token')->plainTextToken;

        AuditLogger::log('user.login', User::class, $user->id, $user->id, null, ['method' => 'SSO ('.Str::ucfirst($provider).')'], 200);

        $props = [
            'token' => $token,
            'user' => array_merge($user->load('roles')->toArray(), [
                'roles' => $user->getRoleNames()->values()->toArray(),
                'permissions' => $user->getAllPermissions()->pluck('name')->values()->toArray(),
            ]),
        ];
        Cache::put($doneKey, $props, now()->addMinutes(2));

        return Inertia::render('Auth/OAuthSuccess', $props);
    }

    /** Exchanges the code for the user, retrying once when the connection to the provider drops. */
    private function fetchUser(string $provider): \Laravel\Socialite\Contracts\User
    {
        $attempt = 0;
        while (true) {
            try {
                return Socialite::driver($this->driverName($provider))
                    ->stateless()
                    ->setHttpClient(new GuzzleClient([
                        'connect_timeout' => 10,
                        'timeout' => 25,
                        'curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4],
                    ]))
                    ->user();
            } catch (ConnectException $e) {
                // Only a failed connection is retried: the code was never used, so it is still valid.
                if (++$attempt >= 2) {
                    throw $e;
                }
                usleep(400_000);
            }
        }
    }

    /** Shows the sign-in finished by the callback that redeemed this code, once it has. */
    private function awaitOtherCallback(string $doneKey): Response|RedirectResponse
    {
        $deadline = now()->addSeconds(self::AWAIT_SECONDS);

        do {
            if ($done = Cache::get($doneKey)) {
                return Inertia::render('Auth/OAuthSuccess', $done);
            }
            Sleep::for(250)->milliseconds();
        } while (now()->lessThan($deadline));

        return $this->fail('This sign-in was already used. Please tap "Continue" again.');
    }

    /** Microsoft's AADSTS54005: the authorization code was already exchanged for a token. */
    private function isCodeAlreadyRedeemed(\Throwable $e): bool
    {
        return $e instanceof ClientException && str_contains((string) $e->getResponse()->getBody(), 'AADSTS54005');
    }

    private function isNetworkProblem(\Throwable $e): bool
    {
        return $e instanceof ConnectException
            || str_contains($e->getMessage(), 'cURL error 28')
            || str_contains($e->getMessage(), 'timed out');
    }

    private function fail(string $message): RedirectResponse
    {
        return redirect('/login?sso_error='.urlencode($message));
    }

    private function auditFailure(string $provider, string $reason): void
    {
        AuditLogger::log('user.login_failed', 'User', 'unknown', null, null, [
            'method' => 'SSO ('.Str::ucfirst($provider).')',
            'reason' => $reason,
        ], 401);
    }

    private function findOrCreateUser(string $provider, \Laravel\Socialite\Contracts\User $socialUser): User
    {
        $email = $socialUser->getEmail();
        $oauthId = (string) $socialUser->getId();

        // 1. Find by provider + oauth_id (returning user who logged in before)
        $user = User::where('oauth_provider', $provider)->where('oauth_id', $oauthId)->first();

        if ($user) {
            return $user;
        }

        // 2. Find by email — link OAuth to existing password account
        $user = User::where('email', $email)->first();

        if ($user) {
            $user->update(['oauth_provider' => $provider, 'oauth_id' => $oauthId]);

            return $user;
        }

        $user = User::create([
            'name' => $socialUser->getName() ?? $email,
            'email' => $email,
            'password' => bcrypt(Str::random(32)), // not usable for login
            'email_verified_at' => now(),
            'status' => 'active',
            'oauth_provider' => $provider,
            'oauth_id' => $oauthId,
            'avatar' => $socialUser->getAvatar(),
            'registration_method' => 'oauth_'.$provider,
        ]);

        $defaultRole = Role::where('name', 'guest')->first();
        if ($defaultRole) {
            $user->assignRole($defaultRole);
        }

        return $user;
    }

    private function applyProviderConfig(string $provider): void
    {
        $redirectBase = config('app.url');

        if ($provider === 'google') {
            $creds = Cache::remember('oauth_creds_google', 3600, fn () => [
                'client_id' => AppSetting::where('key', 'google_client_id')->value('value'),
                'client_secret' => AppSetting::where('key', 'google_client_secret')->value('value'),
            ]);
            config([
                'services.google.client_id' => $creds['client_id'],
                'services.google.client_secret' => $creds['client_secret'],
                'services.google.redirect' => "{$redirectBase}/auth/oauth/google/callback",
            ]);
        } else {
            $creds = Cache::remember('oauth_creds_microsoft', 3600, fn () => [
                'client_id' => AppSetting::where('key', 'microsoft_client_id')->value('value'),
                'client_secret' => AppSetting::where('key', 'microsoft_client_secret')->value('value'),
                'tenant' => AppSetting::where('key', 'microsoft_tenant_id')->value('value') ?: 'common',
            ]);
            config([
                'services.azure.client_id' => $creds['client_id'],
                'services.azure.client_secret' => $creds['client_secret'],
                'services.azure.tenant' => $creds['tenant'],
                'services.azure.redirect' => "{$redirectBase}/auth/oauth/microsoft/callback",
            ]);
        }
    }

    private function driverName(string $provider): string
    {
        return $provider === 'microsoft' ? 'azure' : 'google';
    }

    private function scopes(string $provider): array
    {
        return $provider === 'microsoft'
            ? ['openid', 'profile', 'email']
            : ['openid', 'profile', 'email'];
    }
}
