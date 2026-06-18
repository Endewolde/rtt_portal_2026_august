<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\FeedbackSubmission;
use App\Models\User;
use App\Services\AuthService;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly SubscriptionService $subscriptionService,
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        abort_if(
            AppSetting::where('key', 'self_registration')->value('value') === 'false',
            403,
            'Self-registration is currently disabled. Please contact the system administrator for more information or visit the administration office for assistance.'
        );

        $result = $this->authService->register($request->validated());

        return response()->json([
            'data' => ['user' => $result['user']],
            'message' => 'Registration successful. Please check your email to verify your account.',
            'errors' => [],
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $result = $this->authService->login($request->validated());
        } catch (ValidationException $e) {
            return response()->json([
                'data' => null,
                'message' => 'Invalid credentials.',
                'errors' => $e->errors(),
            ], 422);
        }

        if ($result['requires_2fa']) {
            return response()->json([
                'data' => [
                    'requires_2fa' => true,
                    'partial_token' => $result['partial_token'],
                ],
                'message' => 'A verification code has been sent to your email.',
                'errors' => [],
                'meta' => [],
            ]);
        }

        $user = $result['user'];

        return response()->json([
            'data' => [
                'token' => $result['token'],
                'user' => $this->buildUserPayload($user),
                'evicted_session' => $result['evicted_session'],
            ],
            'message' => $result['evicted_session']
                ? 'Login successful. Your previous session on another device has been logged out.'
                : 'Login successful.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return response()->json([
            'data' => null,
            'message' => 'Logged out successfully.',
            'errors' => [],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('roles');

        return response()->json([
            'data' => ['user' => $this->buildUserPayload($user)],
            'message' => 'Authenticated user retrieved.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** @return array<string, mixed> */
    private function buildUserPayload(User $user): array
    {
        $subscription = null;

        if ($user->college_id) {
            $college = $user->college()->first();
            $subscription = $college ? $this->subscriptionService->getSubscriptionSummary($college) : null;
        }

        return array_merge($user->toArray(), [
            'roles' => $user->getRoleNames()->values()->toArray(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->toArray(),
            'subscription' => $subscription,
            'feedback_submitted' => FeedbackSubmission::hasSubmittedCurrentRound($user->id),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'avatar' => ['sometimes', 'nullable', 'string', 'max:500'],
            'employee_id' => ['sometimes', 'nullable', 'string', 'max:50'],
            'gender' => ['sometimes', 'nullable', 'in:male,female,other'],
        ]);

        $request->user()->update($validated);

        $user = $request->user()->fresh()->load('roles');

        return response()->json([
            'data' => ['user' => $user],
            'message' => 'Profile updated.',
            'errors' => [],
        ]);
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate(['avatar' => 'required|image|max:2048']);

        $path = $request->file('avatar')->store('avatars', 'public');
        $url = Storage::url($path);

        $request->user()->update(['avatar' => $url]);

        return response()->json([
            'data' => ['url' => $url],
            'message' => 'Avatar updated.',
            'errors' => [],
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($request->current_password, $request->user()->password)) {
            return response()->json([
                'data' => null,
                'message' => 'Current password is incorrect.',
                'errors' => ['current_password' => ['Current password is incorrect.']],
            ], 422);
        }

        $request->user()->update([
            'password' => Hash::make($request->password),
        ]);

        return response()->json([
            'data' => null,
            'message' => 'Password changed successfully.',
            'errors' => [],
        ]);
    }

    // ── Forgot / Reset password ───────────────────────────────────────────────

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $request->email)->first();

        // Always respond the same way — never reveal whether the email exists
        if ($user) {
            $rawToken = Str::random(64);
            $hashedToken = hash('sha256', $rawToken);

            DB::table('password_reset_tokens')->upsert(
                ['email' => $user->email, 'token' => $hashedToken, 'created_at' => now()],
                ['email'],
                ['token', 'created_at'],
            );

            $resetUrl = config('app.url').'/reset-password?token='.$rawToken.'&email='.urlencode($user->email);
            $expiresAt = now()->addMinutes(60)->format('d M Y, H:i');

            SendRawMailJob::dispatchSync(
                view('emails.password_reset', [
                    'userName' => $user->name,
                    'resetUrl' => $resetUrl,
                    'expiresAt' => $expiresAt,
                    'senderName' => config('mail.from.name'),
                ])->render(),
                $user->email,
                $user->name,
                'Reset Your Password — RTT Platform'
            );
        }

        return response()->json([
            'data' => null,
            'message' => 'If that email exists in our system, you will receive a reset link shortly.',
            'errors' => [],
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $hashedToken = hash('sha256', $request->token);
        $record = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->where('token', $hashedToken)
            ->first();

        if (! $record) {
            return response()->json([
                'message' => 'This reset link is invalid.',
                'errors' => ['token' => ['Invalid or expired reset link.']],
            ], 422);
        }

        // Expire after 60 minutes
        if (now()->diffInMinutes($record->created_at, false) < -60) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();

            return response()->json([
                'message' => 'This reset link has expired. Please request a new one.',
                'errors' => ['token' => ['Reset link has expired.']],
            ], 422);
        }

        $user = User::where('email', $request->email)->first();
        if (! $user) {
            return response()->json(['message' => 'User not found.', 'errors' => []], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);
        $user->tokens()->delete(); // Invalidate all existing sessions

        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return response()->json([
            'data' => null,
            'message' => 'Password reset successfully. You can now log in with your new password.',
            'errors' => [],
        ]);
    }

    // ── Email verification ────────────────────────────────────────────────────

    public function verifyEmail(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || $user->email_verification_token !== $request->token) {
            return response()->json([
                'message' => 'Invalid verification link.',
                'errors' => ['token' => ['This verification link is invalid.']],
            ], 422);
        }

        if ($user->email_verification_expires_at && now()->isAfter($user->email_verification_expires_at)) {
            return response()->json([
                'message' => 'Verification link has expired. Please register again or request a new link.',
                'errors' => ['token' => ['Verification link expired.']],
            ], 422);
        }

        if ($user->email_verified_at) {
            // Already verified — just issue a token so they can log in
            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'data' => ['token' => $token, 'user' => $this->buildUserPayload($user->load('roles'))],
                'message' => 'Email already verified. You are now logged in.',
                'errors' => [],
            ]);
        }

        $user->update([
            'email_verified_at' => now(),
            'email_verification_token' => null,
            'email_verification_expires_at' => null,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => ['token' => $token, 'user' => $this->buildUserPayload($user->fresh()->load('roles'))],
            'message' => 'Email verified successfully! You are now logged in.',
            'errors' => [],
        ]);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $request->email)->whereNull('email_verified_at')->first();

        // Never reveal whether the email exists
        if ($user) {
            $this->authService->sendVerificationEmail($user);
        }

        return response()->json([
            'data' => null,
            'message' => 'If that email is pending verification, a new link has been sent.',
            'errors' => [],
        ]);
    }

    public function generateTelegramToken(Request $request): JsonResponse
    {
        $token = $this->authService->generateTelegramLinkToken($request->user());

        return response()->json([
            'data' => ['token' => $token],
            'message' => 'Telegram link token generated.',
            'errors' => [],
        ]);
    }

    public function verify2FA(Request $request): JsonResponse
    {
        $request->validate([
            'partial_token' => 'required|string|uuid',
            'code' => 'required|string|size:6',
        ]);

        try {
            $result = $this->authService->verifyTwoFactorCode(
                $request->partial_token,
                $request->code
            );
        } catch (ValidationException $e) {
            return response()->json([
                'data' => null,
                'message' => 'Verification failed.',
                'errors' => $e->errors(),
            ], 422);
        }

        return response()->json([
            'data' => [
                'token' => $result['token'],
                'user' => $this->buildUserPayload($result['user']),
                'evicted_session' => $result['evicted_session'],
            ],
            'message' => 'Login successful.',
            'errors' => [],
        ]);
    }

    public function resend2FA(Request $request): JsonResponse
    {
        $request->validate(['partial_token' => 'required|string|uuid']);

        $userId = Cache::get("2fa_user:{$request->partial_token}");

        if (! $userId) {
            return response()->json([
                'data' => null,
                'message' => 'Verification session expired. Please sign in again.',
                'errors' => [],
            ], 422);
        }

        $user = User::findOrFail($userId);
        $partialToken = $this->authService->sendTwoFactorCode($user);

        Cache::forget("2fa_user:{$request->partial_token}");

        return response()->json([
            'data' => ['partial_token' => $partialToken],
            'message' => 'A new code has been sent to your email.',
            'errors' => [],
        ]);
    }

    public function toggle2FA(Request $request): JsonResponse
    {
        $request->validate(['enabled' => 'required|boolean']);

        $request->user()->update(['two_factor_enabled' => $request->enabled]);

        return response()->json([
            'data' => ['two_factor_enabled' => $request->enabled],
            'message' => $request->enabled
                ? 'Two-factor authentication enabled.'
                : 'Two-factor authentication disabled.',
            'errors' => [],
        ]);
    }

    public function telegramWebhook(Request $request): JsonResponse
    {
        $token = $request->input('token');
        $chatId = $request->input('chat_id');

        if (! $token || ! $chatId) {
            return response()->json([
                'data' => null,
                'message' => 'Token and chat_id are required.',
                'errors' => [],
            ], 422);
        }

        try {
            $user = $this->authService->linkTelegramAccount($token, $chatId);
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
            ], 422);
        }

        return response()->json([
            'data' => ['user_id' => $user->id],
            'message' => 'Telegram account linked successfully.',
            'errors' => [],
        ]);
    }
}
