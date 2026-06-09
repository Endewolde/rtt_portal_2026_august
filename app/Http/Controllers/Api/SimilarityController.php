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
        $flags = SimilarityScore::with([
            'proposal:id,tracker_number,title,status,college_id',
            'proposal.college:id,name',
            'similarProposal:id,tracker_number,title',
        ])
            ->when($request->boolean('flagged_only'), fn ($q) => $q->where('flagged', true))
            ->orderByDesc('score')
            ->orderByDesc('checked_at')
            ->paginate(25);

        return response()->json([
            'data'    => $flags,
            'message' => '',
            'errors'  => [],
            'meta'    => [],
        ]);
    }
}
