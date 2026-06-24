<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\User;
use GuzzleHttp\Client as GuzzleClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Socialite\Facades\Socialite;
use Spatie\Permission\Models\Role;

class OAuthController extends Controller
{
    private const SUPPORTED = ['google', 'microsoft'];

    public function redirect(string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, self::SUPPORTED), 404);
        abort_unless(AppSetting::where('key', "{$provider}_sso_enabled")->value('value') === 'true', 403, 'SSO is not enabled for this provider.');

        $this->applyProviderConfig($provider);

        return Socialite::driver($this->driverName($provider))
            ->scopes($this->scopes($provider))
            ->with(['prompt' => 'select_account'])
            ->redirect();
    }

    public function callback(string $provider): Response|RedirectResponse
    {
        abort_unless(in_array($provider, self::SUPPORTED), 404);
        abort_unless(AppSetting::where('key', "{$provider}_sso_enabled")->value('value') === 'true', 403, 'SSO is not enabled for this provider.');

        $this->applyProviderConfig($provider);

        try {
            $socialUser = Socialite::driver($this->driverName($provider))
                ->setHttpClient(new GuzzleClient([
                    'connect_timeout' => 8,
                    'timeout' => 15,
                    'curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4],
                ]))
                ->user();
        } catch (\Exception $e) {
            Log::warning("[SSO] OAuth callback failed for {$provider}: ".$e->getMessage());

            return redirect('/login?sso_error='.urlencode('Authentication failed. Please try again.'));
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

        return Inertia::render('Auth/OAuthSuccess', [
            'token' => $token,
            'user' => array_merge($user->load('roles')->toArray(), [
                'roles' => $user->getRoleNames()->values()->toArray(),
                'permissions' => $user->getAllPermissions()->pluck('name')->values()->toArray(),
            ]),
        ]);
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
