<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\ReviewerMatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewerMatchController extends Controller
{
    public function __construct(private ReviewerMatchService $matcher) {}

    public function suggestions(Request $request, string $proposalId): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasPermissionTo('reviewer_match.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $proposal = Proposal::findOrFail($proposalId);

        ['reviewers' => $scored, 'terms' => $proposalTerms] = $this->matcher->rank($proposal);

        return response()->json([
            'data' => $scored,
            'message' => 'Suggestions retrieved.',
            'errors' => [],
            'meta' => [
                'proposal_terms' => $proposalTerms->take(15)->values(),
                'total_matched' => $scored->count(),
            ],
        ]);
    }
}
