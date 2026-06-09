<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use App\Services\AuthService;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly SubscriptionService $subscriptionService,
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return response()->json([
            'data'    => ['user' => $result['user'], 'token' => $result['token']],
            'message' => 'Registration successful.',
            'errors'  => [],
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $result = $this->authService->login($request->validated());
        } catch (ValidationException $e) {
            return response()->json([
                'data'    => null,
                'message' => 'Invalid credentials.',
                'errors'  => $e->errors(),
            ], 422);
        }

        $user = $result['user'];

        return response()->json([
            'data'    => [
                'token' => $result['token'],
                'user'  => $this->buildUserPayload($user),
            ],
            'message' => 'Login successful.',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return response()->json([
            'data'    => null,
            'message' => 'Logged out successfully.',
            'errors'  => [],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('roles');

        return response()->json([
            'data'    => ['user' => $this->buildUserPayload($user)],
            'message' => 'Authenticated user retrieved.',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    /** @return array<string, mixed> */
    private function buildUserPayload(User $user): array
    {
        $subscription = null;

        if ($user->college_id) {
            $college      = $user->college()->first();
            $subscription = $college ? $this->subscriptionService->getSubscriptionSummary($college) : null;
        }

        return array_merge($user->toArray(), [
            'roles'        => $user->getRoleNames()->values()->toArray(),
            'permissions'  => $user->getAllPermissions()->pluck('name')->values()->toArray(),
            'subscription' => $subscription,
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'phone'       => ['sometimes', 'nullable', 'string', 'max:30'],
            'avatar'      => ['sometimes', 'nullable', 'string', 'max:500'],
            'employee_id' => ['sometimes', 'nullable', 'string', 'max:50'],
            'gender'      => ['sometimes', 'nullable', 'in:male,female,other'],
        ]);

        $request->user()->update($validated);

        $user = $request->user()->fresh()->load('roles');

        return response()->json([
            'data'    => ['user' => $user],
            'message' => 'Profile updated.',
            'errors'  => [],
        ]);
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate(['avatar' => 'required|image|max:2048']);

        $path = $request->file('avatar')->store('avatars', 'public');
        $url  = \Illuminate\Support\Facades\Storage::url($path);

        $request->user()->update(['avatar' => $url]);

        return response()->json([
            'data'    => ['url' => $url],
            'message' => 'Avatar updated.',
            'errors'  => [],
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! \Illuminate\Support\Facades\Hash::check($request->current_password, $request->user()->password)) {
            return response()->json([
                'data'    => null,
                'message' => 'Current password is incorrect.',
                'errors'  => ['current_password' => ['Current password is incorrect.']],
            ], 422);
        }

        $request->user()->update([
            'password' => \Illuminate\Support\Facades\Hash::make($request->password),
        ]);

        return response()->json([
            'data'    => null,
            'message' => 'Password changed successfully.',
            'errors'  => [],
        ]);
    }

    public function generateTelegramToken(Request $request): JsonResponse
    {
        $token = $this->authService->generateTelegramLinkToken($request->user());

        return response()->json([
            'data'    => ['token' => $token],
            'message' => 'Telegram link token generated.',
            'errors'  => [],
        ]);
    }

    public function telegramWebhook(Request $request): JsonResponse
    {
        $token  = $request->input('token');
        $chatId = $request->input('chat_id');

        if (! $token || ! $chatId) {
            return response()->json([
                'data'    => null,
                'message' => 'Token and chat_id are required.',
                'errors'  => [],
            ], 422);
        }

        try {
            $user = $this->authService->linkTelegramAccount($token, $chatId);
        } catch (\Exception $e) {
            return response()->json([
                'data'    => null,
                'message' => $e->getMessage(),
                'errors'  => [],
            ], 422);
        }

        return response()->json([
            'data'    => ['user_id' => $user->id],
            'message' => 'Telegram account linked successfully.',
            'errors'  => [],
        ]);
    }
}
