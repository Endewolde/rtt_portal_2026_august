<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SimilarityScore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SimilarityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('similarity.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $query = SimilarityScore::with([
            'proposal:id,tracker_number,title,status,college_id,category,abstract',
            'proposal.college:id,name',
            'similarProposal:id,tracker_number,title,status,abstract',
        ]);

        if ($request->boolean('flagged_only')) {
            $query->where('flagged', true);
        }

        if ($request->filled('min_score')) {
            $query->where('score', '>=', (float) $request->input('min_score'));
        }

        if ($request->filled('category')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', $request->input('category')));
        }

        $flags = $query->orderByDesc('score')->orderByDesc('checked_at')->paginate(25);

        $summary = [
            'total' => SimilarityScore::count(),
            'flagged' => SimilarityScore::where('flagged', true)->count(),
            'critical' => SimilarityScore::where('score', '>=', 0.80)->count(),
            'avg_score' => round((float) SimilarityScore::avg('score') * 100, 1),
        ];

        return response()->json([
            'data' => $flags,
            'summary' => $summary,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
