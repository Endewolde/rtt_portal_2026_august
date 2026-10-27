<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundAward;
use App\Models\ExternalFundExpenditure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExpenditureController extends Controller
{
    public function index(Request $request, string $awardId): JsonResponse
    {
        $award = ExternalFundAward::with('application')->findOrFail($awardId);
        if (! $award->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

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
            'expense_date' => 'required|date|before_or_equal:today',
            'category' => 'required|in:personnel,equipment,travel,overhead,subcontract,other',
        ]);

        if ($award->status !== 'active') {
            return response()->json(['message' => 'Spending can only be recorded on an active award — this one is '.$award->status.'.', 'errors' => []], 422);
        }

        if (! empty($data['budget_id'])
            && ! $award->application?->budgets()->whereKey($data['budget_id'])->exists()) {
            return response()->json(['message' => 'That budget line belongs to a different application.', 'errors' => ['budget_id' => ['That budget line belongs to a different application.']]], 422);
        }

        $data['award_id'] = $award->id;
        $data['recorded_by'] = $request->user()->id;

        $expenditure = DB::transaction(function () use ($award, $data) {
            // Locked so two people recording at once cannot both slip under the limit.
            $locked = ExternalFundAward::whereKey($award->id)->lockForUpdate()->first();
            $remaining = (float) $locked->amount_awarded - (float) $locked->expenditures()->sum('amount');

            if ((float) $data['amount'] > round($remaining, 2)) {
                return null;
            }

            return ExternalFundExpenditure::create($data);
        });

        if (! $expenditure) {
            $remaining = max(0, (float) $award->amount_awarded - (float) $award->expenditures()->sum('amount'));
            $message = 'Insufficient award balance — only '.number_format($remaining, 2).' '.($award->currency ?: '').' remains.';

            return response()->json(['message' => trim($message), 'errors' => ['amount' => [trim($message)]], 'meta' => ['remaining' => $remaining]], 422);
        }

        return response()->json([
            'data' => $expenditure->load(['recordedBy:id,name', 'budget:id,category,description']),
            'message' => 'Expenditure recorded.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.expenditure')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ExternalFundExpenditure::findOrFail($id)->delete();

        return response()->json(['data' => null, 'message' => 'Expenditure removed.', 'errors' => [], 'meta' => []]);
    }
}
