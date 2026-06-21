<?php

namespace App\Services;

use App\Mail\TwoFactorCodeMail;
use App\Models\AppSetting;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    /**
     * Register a new user, assign guest role, create notification preferences.
     *
     * @return array{ user: User, token: string }
     */
    public function register(array $data): array
    {
        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'title' => $data['title'] ?? null,
                'email' => $data['email'],
                'password' => Hash::make($data['password'] ?? Str::random(32)),
                'employee_id' => $data['employee_id'] ?? null,
                'college_id' => $data['college_id'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'phone' => $data['phone'] ?? null,
                'gender' => $data['gender'] ?? null,
                'expertise' => $data['expertise'] ?? null,
                'status' => 'active',
                'registration_method' => 'self_registered',
            ]);

            $user->assignRole('guest');

            NotificationPreference::create([
                'user_id' => $user->id,
                'email_enabled' => true,
                'telegram_enabled' => true,
                'inapp_enabled' => true,
            ]);

            DB::table('audit_logs')->insert([
                'id' => Str::uuid()->toString(),
                'auditable_type' => User::class,
                'auditable_id' => $user->id,
                'event' => 'user.registered',
                'actor_id' => $user->id,
                'old_values' => null,
                'new_values' => json_encode(['email' => $user->email, 'role' => 'guest']),
                'ip_address' => request()->ip() ?? '127.0.0.1',
                'user_agent' => request()->userAgent() ?? '',
                'created_at' => now(),
            ]);

            return $user;
        });

        event(new Registered($user));

        // Send verification email; token is issued only after email is verified
        $this->sendVerificationEmail($user);

        return ['user' => $user, 'token' => null];
    }

    /**
     * Authenticate a user and return token. If the concurrent session limit has
     * been reached, the oldest session is evicted to make room and `evicted_session`
     * is set so the caller can let the user know their other device was logged out.
     *
     * @return array{ user: User, token: string, evicted_session: bool }
     *
     * @throws ValidationException
     */
    public function login(array $credentials): array
    {
        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->email_verified_at) {
            throw ValidationException::withMessages([
                'email' => ['email_not_verified'],
            ]);
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => ['Your account is not active. Please contact the administrator.'],
            ]);
        }

        if ($user->two_factor_enabled) {
            $partialToken = $this->sendTwoFactorCode($user);

            return [
                'user' => null,
                'token' => null,
                'evicted_session' => false,
                'requires_2fa' => true,
                'partial_token' => $partialToken,
            ];
        }

        return $this->issueToken($user);
    }

    /**
     * @return array{ user: User, token: string, evicted_session: bool, requires_2fa: false }
     */
    private function issueToken(User $user): array
    {
        $user->update([
            'last_login_at' => now(),
            'first_login_at' => $user->first_login_at ?? now(),
        ]);

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'event' => 'user.login',
            'actor_id' => $user->id,
            'old_values' => null,
            'new_values' => json_encode(['ip' => request()->ip()]),
            'ip_address' => request()->ip() ?? '127.0.0.1',
            'user_agent' => request()->userAgent() ?? '',
            'created_at' => now(),
        ]);

        $evictedSession = $this->enforceConcurrentSessionLimit($user);

        $token = $user->createToken('auth_token')->plainTextToken;

        return [
            'user' => $user->load('roles'),
            'token' => $token,
            'evicted_session' => $evictedSession,
            'requires_2fa' => false,
            'partial_token' => null,
        ];
    }

    /**
     * Generate a 6-digit OTP, cache it with a partial token, send the email.
     * Returns the partial token the client must submit with the OTP.
     */
    public function sendTwoFactorCode(User $user): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $partialToken = Str::uuid()->toString();

        Cache::put("2fa_user:{$partialToken}", $user->id, 300);
        Cache::put("2fa_code:{$user->id}", $code, 300);

        Mail::to($user->email)->send(new TwoFactorCodeMail($user, $code));

        return $partialToken;
    }

    /**
     * Validate partial token + OTP code and issue a full auth token.
     *
     * @return array{ user: User, token: string, evicted_session: bool, requires_2fa: false }
     *
     * @throws ValidationException
     */
    public function verifyTwoFactorCode(string $partialToken, string $code): array
    {
        $userId = Cache::get("2fa_user:{$partialToken}");

        if (! $userId) {
            throw ValidationException::withMessages([
                'partial_token' => ['Verification session expired or invalid. Please sign in again.'],
            ]);
        }

        $user = User::findOrFail($userId);

        $cached = Cache::get("2fa_code:{$userId}");

        if (! $cached || ! hash_equals($cached, $code)) {
            throw ValidationException::withMessages([
                'code' => ['The verification code is incorrect.'],
            ]);
        }

        Cache::forget("2fa_user:{$partialToken}");
        Cache::forget("2fa_code:{$userId}");

        return $this->issueToken($user);
    }

    /**
     * Revoke the oldest active sessions if the user is at/over the configured concurrent session limit.
     * A limit of 0 (or unset) means unlimited concurrent sessions.
     *
     * @return bool whether any session was evicted
     */
    protected function enforceConcurrentSessionLimit(User $user): bool
    {
        $limit = (int) (AppSetting::where('key', 'max_concurrent_sessions')->value('value') ?? 0);

        if ($limit <= 0) {
            return false;
        }

        $excess = $user->tokens()->count() - $limit + 1;

        if ($excess <= 0) {
            return false;
        }

        $evicted = $user->tokens()->oldest()->take($excess)->get();

        foreach ($evicted as $token) {
            DB::table('audit_logs')->insert([
                'id' => Str::uuid()->toString(),
                'auditable_type' => User::class,
                'auditable_id' => $user->id,
                'event' => 'user.session_evicted',
                'actor_id' => $user->id,
                'old_values' => null,
                'new_values' => json_encode(['reason' => 'concurrent_session_limit', 'token_name' => $token->name]),
                'ip_address' => request()->ip() ?? '127.0.0.1',
                'user_agent' => request()->userAgent() ?? '',
                'created_at' => now(),
            ]);

            $token->delete();
        }

        return true;
    }

    /**
     * Revoke the current token and log the logout.
     */
    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'event' => 'user.logout',
            'actor_id' => $user->id,
            'old_values' => null,
            'new_values' => null,
            'ip_address' => request()->ip() ?? '127.0.0.1',
            'user_agent' => request()->userAgent() ?? '',
            'created_at' => now(),
        ]);
    }

    /**
     * Generate a one-time Telegram link token valid for 10 minutes.
     */
    public function generateTelegramLinkToken(User $user): string
    {
        $token = Str::random(32);

        $user->update([
            'telegram_link_token' => $token,
            'telegram_link_token_expires_at' => now()->addMinutes(10),
        ]);

        return $token;
    }

    /**
     * Link a Telegram account to a user via the one-time token.
     *
     * @throws \Exception
     */
    public function linkTelegramAccount(string $token, string $chatId): User
    {
        $user = User::where('telegram_link_token', $token)
            ->where('telegram_link_token_expires_at', '>', now())
            ->first();

        if (! $user) {
            throw new \Exception('Invalid or expired Telegram link token.');
        }

        $user->update([
            'telegram_chat_id' => $chatId,
            'telegram_link_token' => null,
            'telegram_link_token_expires_at' => null,
        ]);

        return $user;
    }

    /** Generate a verification token, persist it, and send the confirmation email. */
    public function sendVerificationEmail(User $user): void
    {
        $token = Str::random(64);

        $user->update([
            'email_verification_token' => $token,
            'email_verification_expires_at' => now()->addHours(24),
        ]);

        app(MailConfigService::class)->applyFromDatabase();

        $verifyUrl = config('app.url').'/verify-email?token='.$token.'&email='.urlencode($user->email);

        try {
            Mail::html(
                view('emails.verify_email', [
                    'userName' => $user->name,
                    'verifyUrl' => $verifyUrl,
                    'senderName' => config('mail.from.name'),
                ])->render(),
                fn ($msg) => $msg->to($user->email, $user->name)
                    ->subject('Please Verify Your Email — RTT Platform')
            );
        } catch (\Exception) {
            // Absorb mail failures silently; token is still stored for resend
        }
    }
}
