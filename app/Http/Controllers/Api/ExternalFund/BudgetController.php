<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundBudget;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetController extends Controller
{
    public function index(Request $request, string $applicationId): JsonResponse
    {
        $application = ExternalFundApplication::findOrFail($applicationId);
        if (! $application->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $budgets = $application->budgets()
            ->withSum('expenditures', 'amount')
            ->get();

        return response()->json(['data' => $budgets, 'message' => '', 'errors' => [], 'meta' => [
            'total_proposed' => (float) $budgets->sum('proposed_amount'),
            'total_approved' => (float) $budgets->sum('approved_amount'),
        ]]);
    }

    public function store(Request $request, string $applicationId): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $application = ExternalFundApplication::findOrFail($applicationId);

        $data = $request->validate([
            'category' => 'required|in:personnel,equipment,travel,overhead,subcontract,other',
            'description' => 'required|string|max:255',
            'proposed_amount' => 'required|numeric|min:0',
            'approved_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $data['application_id'] = $application->id;
        $data['award_id'] = $application->award?->id;

        $budget = ExternalFundBudget::create($data);

        return response()->json(['data' => $budget, 'message' => 'Budget line added.', 'errors' => [], 'meta' => []], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $budget = ExternalFundBudget::findOrFail($id);

        $data = $request->validate([
            'category' => 'sometimes|in:personnel,equipment,travel,overhead,subcontract,other',
            'description' => 'sometimes|string|max:255',
            'proposed_amount' => 'sometimes|numeric|min:0',
            'approved_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $budget->update($data);

        return response()->json(['data' => $budget->fresh(), 'message' => 'Budget updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $budget = ExternalFundBudget::findOrFail($id);
        if ($budget->expenditures()->exists()) {
            return response()->json(['message' => 'Spending has been recorded against this budget line, so it cannot be deleted.', 'errors' => []], 422);
        }
        $budget->delete();

        return response()->json(['data' => null, 'message' => 'Budget line deleted.', 'errors' => [], 'meta' => []]);
    }
}
