<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetMilestone;
use App\Models\Proposal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetMilestoneController extends Controller
{
    private const RUNNING = ['funded', 'midterm_evaluation', 'completed'];

    /**
     * Every running project the user may see, with its milestones and award, in one
     * call — the tracker page no longer asks project by project.
     */
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('budget_milestones.view_any') && ! $user->can('budget_milestones.view')) {
            return response()->json(['data' => [], 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $query = Proposal::whereIn('status', self::RUNNING)
            ->with([
                'college:id,name',
                'pi:id,name',
                'award:id,proposal_id,awarded_amount',
                'budgetMilestones' => fn ($q) => $q->orderBy('sort_order')->orderBy('due_date'),
            ])
            ->orderBy('tracker_number');

        if ($user->can('budget_milestones.view_any')) {
            $user->accessScope()->constrain($query, 'proposals', fn ($q) => $q->where('pi_user_id', $user->id));
        } else {
            $query->where('pi_user_id', $user->id);
        }

        $projects = $query->get(['id', 'tracker_number', 'title', 'status', 'category', 'college_id', 'pi_user_id', 'academic_year']);

        return response()->json(['data' => $projects, 'message' => 'OK.', 'errors' => []]);
    }

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
        abort_unless($budgetMilestone->proposal_id === $proposal->id, 404);

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
        abort_unless($budgetMilestone->proposal_id === $proposal->id, 404);

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

        return ($user->can('budget_milestones.view_any') && $user->accessScope()->covers($proposal->college_id, $proposal->category))
            || ($user->can('budget_milestones.view') && $proposal->pi_user_id === $user->id);
    }

    /** Editing needs the permission and the project within the user's scope. */
    private function canEdit(?object $user, Proposal $proposal): bool
    {
        return (bool) $user?->can('budget_milestones.update') && $user->accessScope()->covers($proposal->college_id, $proposal->category);
    }
}
