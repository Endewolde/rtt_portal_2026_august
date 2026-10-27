<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function index(Request $request, string $applicationId): JsonResponse
    {
        $application = ExternalFundApplication::findOrFail($applicationId);
        if (! $application->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $reviews = $application->reviews()
            ->with('reviewer:id,name,email')
            ->orderBy('stage')
            ->get();

        return response()->json(['data' => $reviews, 'message' => '', 'errors' => [], 'meta' => [
            'stage_decisions' => $application->stageDecisions(),
            'approved_stages' => $application->approvedStages(),
        ]]);
    }

    public function store(Request $request, string $applicationId): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $application = ExternalFundApplication::findOrFail($applicationId);

        if (! in_array($application->status, ['draft', 'under_internal_review'], true)) {
            return response()->json(['message' => 'Internal review is over for this application — it is '.str_replace('_', ' ', $application->status).'.', 'errors' => []], 422);
        }

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

        $approved = $application->approvedStages();

        return response()->json([
            'data' => $review->load('reviewer:id,name'),
            'message' => count($approved) === count(ExternalFundApplication::STAGES)
                ? 'Review saved. All four stages have approved — it can now be cleared for submission.'
                : 'Review saved.',
            'errors' => [],
            'meta' => ['stage_decisions' => $application->stageDecisions(), 'approved_stages' => $approved],
        ], 201);
    }
}
