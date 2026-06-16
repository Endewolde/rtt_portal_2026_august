<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\FeedbackSubmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class FeedbackController extends Controller
{
    /** Submit feedback — one submission per user per round, enforced at the DB level. */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $round = FeedbackSubmission::currentRound();

        if (FeedbackSubmission::where('user_id', $user->id)->where('round', $round)->exists()) {
            return response()->json(['message' => 'You have already submitted feedback.'], 422);
        }

        $validated = $request->validate([
            'type' => ['required', 'in:feedback,feature_request,bug_report,survey'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'message' => ['required', 'string', 'max:5000'],
            'page_url' => ['nullable', 'string', 'max:500'],
        ]);

        $feedback = FeedbackSubmission::create([
            ...$validated,
            'id' => Str::uuid(),
            'user_id' => $user->id,
            'round' => $round,
        ]);

        return response()->json(['data' => $feedback, 'message' => 'Thank you for your feedback!'], 201);
    }

    /** Admin — paginated list of all submissions. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $submissions = FeedbackSubmission::with('user:id,name,email')
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json([
            'data' => $submissions,
            'meta' => ['current_round' => FeedbackSubmission::currentRound()],
        ]);
    }

    /** Admin — delete a submission. */
    public function destroy(Request $request, FeedbackSubmission $feedback): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $feedback->delete();

        return response()->json(['message' => 'Feedback deleted.']);
    }

    /** Admin — start a new round, re-opening the popup for every user without losing past submissions. */
    public function newRound(Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $nextRound = FeedbackSubmission::currentRound() + 1;

        AppSetting::where('key', 'feedback_current_round')->update(['value' => (string) $nextRound]);

        Cache::forget('inertia_app_settings');
        Cache::forget('blade_app_meta');

        return response()->json([
            'data' => ['current_round' => $nextRound],
            'message' => "Round {$nextRound} started — the popup will reappear for all users.",
        ]);
    }
}
