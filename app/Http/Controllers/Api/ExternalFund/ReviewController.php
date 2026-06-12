<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    private const MANAGERS = ['super_admin', 'admin', 'research_officer', 'central_officer'];

    public function index(Request $request, string $applicationId): JsonResponse
    {
        $application = ExternalFundApplication::findOrFail($applicationId);

        $reviews = $application->reviews()
            ->with('reviewer:id,name,email')
            ->orderBy('stage')
            ->get();

        return response()->json(['data' => $reviews, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request, string $applicationId): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(self::MANAGERS)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $application = ExternalFundApplication::findOrFail($applicationId);

        $data = $request->validate([
            'stage' => 'required|in:department,college,research_office,management',
            'status' => 'required|in:pending,approved,rejected,revision_required',
            'comments' => 'nullable|string',
        ]);

        $review = ExternalFundReview::updateOrCreate(
            [
                'application_id' => $application->id,
                'reviewer_id' => $request->user()->id,
                'stage' => $data['stage'],
            ],
            [
                'status' => $data['status'],
                'comments' => $data['comments'] ?? null,
                'reviewed_at' => now(),
            ]
        );

        // Advance application to under_internal_review if still draft
        if ($application->status === 'draft') {
            $application->update(['status' => 'under_internal_review']);
        }

        return response()->json([
            'data' => $review->load('reviewer:id,name'),
            'message' => 'Review submitted.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }
}
