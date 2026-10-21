<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundAward;
use App\Models\ExternalFundExpenditure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenditureController extends Controller
{
    public function index(Request $request, string $awardId): JsonResponse
    {
        $award = ExternalFundAward::findOrFail($awardId);

        $expenditures = $award->expenditures()
            ->with(['recordedBy:id,name', 'approvedBy:id,name', 'budget:id,category,description'])
            ->latest('expense_date')
            ->get();

        return response()->json([
            'data' => $expenditures,
            'message' => '',
            'errors' => [],
            'meta' => [
                'total_spent' => $expenditures->sum('amount'),
                'amount_awarded' => $award->amount_awarded,
                'remaining_budget' => (float) $award->amount_awarded - $expenditures->sum('amount'),
            ],
        ]);
    }

    public function store(Request $request, string $awardId): JsonResponse
    {
        if (! $request->user()?->can('external_funds.expenditure')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $award = ExternalFundAward::findOrFail($awardId);

        $data = $request->validate([
            'budget_id' => 'nullable|uuid|exists:ef_budgets,id',
            'description' => 'required|string|max:500',
            'amount' => 'required|numeric|min:0.01',
            'expense_date' => 'required|date',
            'category' => 'required|in:personnel,equipment,travel,overhead,subcontract,other',
        ]);

        $data['award_id'] = $award->id;
        $data['recorded_by'] = $request->user()->id;

        $expenditure = ExternalFundExpenditure::create($data);

        return response()->json([
            'data' => $expenditure->load('recordedBy:id,name'),
            'message' => 'Expenditure recorded.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }
}
