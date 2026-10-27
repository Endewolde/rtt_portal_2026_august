<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundAward;
use App\Models\ExternalFundMilestone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MilestoneController extends Controller
{
    public function index(Request $request, string $awardId): JsonResponse
    {
        $award = ExternalFundAward::with('application')->findOrFail($awardId);
        if (! $award->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $milestones = $award->milestones()->orderBy('due_date')->get();

        return response()->json(['data' => $milestones, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request, string $awardId): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $award = ExternalFundAward::findOrFail($awardId);

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'due_date' => 'required|date',
            'status' => 'sometimes|in:pending,in_progress,completed',
        ]);

        $data['award_id'] = $award->id;
        $milestone = ExternalFundMilestone::create($data);

        return response()->json(['data' => $milestone, 'message' => 'Milestone added.', 'errors' => [], 'meta' => []], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $milestone = ExternalFundMilestone::findOrFail($id);

        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'due_date' => 'sometimes|date',
            'status' => 'sometimes|in:pending,in_progress,completed',
            'completed_at' => 'nullable|date',
        ]);

        if (($data['status'] ?? null) === 'completed' && ! $milestone->completed_at) {
            $data['completed_at'] = now();
        }
        if (isset($data['status']) && $data['status'] !== 'completed') {
            $data['completed_at'] = null;
        }

        $milestone->update($data);

        return response()->json(['data' => $milestone->fresh(), 'message' => 'Milestone updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ExternalFundMilestone::findOrFail($id)->delete();

        return response()->json(['data' => null, 'message' => 'Milestone deleted.', 'errors' => [], 'meta' => []]);
    }
}
