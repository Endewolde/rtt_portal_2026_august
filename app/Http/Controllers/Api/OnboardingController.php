<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OnboardingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The signed-in user's onboarding: welcome, guided tours and checklist, per role. */
class OnboardingController extends Controller
{
    public function __construct(private OnboardingService $onboarding) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $request->validate(['role' => ['nullable', 'string', Rule::in($this->onboarding->rolesFor($user))]]);

        $role = $request->input('role') ?? $this->onboarding->defaultRole($user);

        return $this->ok($this->onboarding->present($user, $this->onboarding->progress($user, $role)));
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in($this->onboarding->rolesFor($user))],
            'welcome_seen' => 'sometimes|boolean',
            'dismissed' => 'sometimes|boolean',
            'active_tour' => 'sometimes|nullable|string|max:80|regex:/^[a-z0-9_.-]+$/',
            'active_step' => 'sometimes|nullable|integer|min:0|max:500',
            'completed_tour' => 'sometimes|string|max:80|regex:/^[a-z0-9_.-]+$/',
            'completed_tasks' => 'sometimes|array|max:50',
            'completed_tasks.*' => 'string|max:80|regex:/^[a-z0-9_.-]+$/',
            'uncompleted_task' => 'sometimes|string|max:80|regex:/^[a-z0-9_.-]+$/',
        ]);

        $progress = $this->onboarding->update($this->onboarding->progress($user, $validated['role']), $validated);

        return $this->ok($this->onboarding->present($user, $progress));
    }

    public function reset(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate(['role' => ['required', 'string', Rule::in($this->onboarding->rolesFor($user))]]);

        $progress = $this->onboarding->reset($this->onboarding->progress($user, $validated['role']));

        return $this->ok($this->onboarding->present($user, $progress), 'Onboarding restarted.');
    }

    private function ok(array $data, string $message = ''): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []]);
    }
}
