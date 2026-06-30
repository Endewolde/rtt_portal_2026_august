<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ProposalAiScore;
use App\Services\ProposalAiScoringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProposalAiScoreController extends Controller
{
    public function show(Request $request, string $proposalId): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasPermissionTo('proposal_ai_scores.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $score = ProposalAiScore::where('proposal_id', $proposalId)->first();

        return response()->json(['data' => $score, 'message' => 'OK.', 'errors' => []]);
    }

    public function generate(Request $request, string $proposalId): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasPermissionTo('proposal_ai_scores.generate')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $proposal = Proposal::findOrFail($proposalId);

        $hasKey = config('services.anthropic.api_key')
            || config('services.gemini.api_key')
            || config('services.groq.api_key');

        if (! $hasKey) {
            return response()->json(['data' => null, 'message' => 'AI scoring is not configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY in your .env.', 'errors' => []], 503);
        }

        $service = new ProposalAiScoringService;
        $score = $service->score($proposal);

        if ($score->status === 'failed') {
            return response()->json(['data' => $score, 'message' => 'AI scoring failed. Check server logs for details.', 'errors' => []], 500);
        }

        return response()->json(['data' => $score, 'message' => 'Scoring complete.', 'errors' => []]);
    }
}
