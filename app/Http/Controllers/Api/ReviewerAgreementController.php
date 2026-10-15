<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReviewerAgreementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewerAgreementController extends Controller
{
    public function __construct(private ReviewerAgreementService $agreements) {}

    /** This year's agreement text and whether the signed-in reviewer has accepted it. */
    public function show(Request $request): JsonResponse
    {
        $current = $this->agreements->current($request->user());

        return response()->json([
            'data' => [
                'academic_year' => $this->agreements->academicYear(),
                'text' => $current?->agreement_text ?? $this->agreements->text(),
                'accepted' => $current !== null,
                'accepted_at' => $current?->accepted_at?->toIso8601String(),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function accept(Request $request): JsonResponse
    {
        $request->validate(['confirm' => 'accepted']);
        $agreement = $this->agreements->accept($request->user(), $request->ip());

        return response()->json([
            'data' => ['accepted' => true, 'accepted_at' => $agreement->accepted_at->toIso8601String()],
            'message' => 'Thank you — the confidentiality agreement is recorded for '.$agreement->academic_year.'.',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
