<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetMilestone;
use App\Models\Proposal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetMilestoneController extends Controller
{
    public function index(Request $request, string $proposalId): JsonResponse
    {
        $proposal = Proposal::findOrFail($proposalId);
        $user = $request->user();

        if (! $this->canAccess($user, $proposal)) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $milestones = BudgetMilestone::where('proposal_id', $proposalId)
            ->orderBy('sort_order')
            ->orderBy('due_date')
            ->get();

        return response()->json(['data' => $milestones, 'message' => 'OK.', 'errors' => []]);
    }

    public function store(Request $request, string $proposalId): JsonResponse
    {
        $proposal = Proposal::findOrFail($proposalId);

        if (! $this->canEdit($request->user(), $proposal)) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'amount' => 'nullable|numeric|min:0',
            'due_date' => 'nullable|date',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $milestone = BudgetMilestone::create([
            ...$data,
            'proposal_id' => $proposalId,
            'status' => 'pending',
            'created_by' => $request->user()->id,
            'sort_order' => $data['sort_order'] ?? (BudgetMilestone::where('proposal_id', $proposalId)->max('sort_order') + 1),
        ]);

        return response()->json(['data' => $milestone, 'message' => 'Milestone created.', 'errors' => []], 201);
    }

    public function update(Request $request, string $proposalId, BudgetMilestone $budgetMilestone): JsonResponse
    {
        $proposal = Proposal::findOrFail($proposalId);

        if (! $this->canEdit($request->user(), $proposal)) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $data = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'amount' => 'nullable|numeric|min:0',
            'due_date' => 'nullable|date',
            'status' => 'nullable|in:pending,in_progress,completed',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if (isset($data['status']) && $data['status'] === 'completed' && ! $budgetMilestone->completed_at) {
            $data['completed_at'] = now();
        } elseif (isset($data['status']) && $data['status'] !== 'completed') {
            $data['completed_at'] = null;
        }

        $budgetMilestone->update($data);

        return response()->json(['data' => $budgetMilestone->fresh(), 'message' => 'Milestone updated.', 'errors' => []]);
    }

    public function destroy(Request $request, string $proposalId, BudgetMilestone $budgetMilestone): JsonResponse
    {
        $proposal = Proposal::findOrFail($proposalId);

        if (! $this->canEdit($request->user(), $proposal)) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $budgetMilestone->delete();

        return response()->json(['data' => null, 'message' => 'Milestone deleted.', 'errors' => []]);
    }

    private function canAccess(?object $user, Proposal $proposal): bool
    {
        if (! $user) {
            return false;
        }

        return $user->hasPermissionTo('budget_milestones.view_any')
            || ($user->hasPermissionTo('budget_milestones.view') && $proposal->pi_user_id === $user->id);
    }

    private function canEdit(?object $user, Proposal $proposal): bool
    {
        return $user?->hasPermissionTo('budget_milestones.update');
    }
}
