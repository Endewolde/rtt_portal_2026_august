<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Services\BudgetSettlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettlementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = BudgetSettlement::with([
            'budgetRequest.proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'budgetRequest.proposal.college:id,name',
            'budgetRequest.proposal.pi:id,name,email',
            'budgetRequest.proposal.award:id,proposal_id,awarded_amount',
            'budgetRequest:id,funding_round,total_amount,proposal_id',
            'submittedBy:id,name,email',
            'collegeVerifiedByUser:id,name',
            'financeVerifiedByUser:id,name',
        ])->orderByDesc('created_at');

        if ($user->hasRole('college_officer') || $user->hasRole('college_officer') ||
            ($user->hasRole('support_officer') && $user->college_id)) {
            $query->whereHas('budgetRequest.proposal', fn ($q) =>
                $q->where('college_id', $user->college_id)
            );
        } elseif (! $user->hasAnyRole(['super_admin', 'central_officer', 'support_officer',
            'research_officer', 'community_officer', 'technology_officer'])) {
            $query->whereHas('budgetRequest.proposal', fn ($q) =>
                $q->where('pi_user_id', $user->id)
                  ->orWhereHas('members', fn ($sq) =>
                      $sq->where('user_id', $user->id)->where('status', 'active')
                  )
            );
        }

        if ($user->hasRole('research_officer')) {
            $query->whereHas('budgetRequest.proposal', fn ($q) =>
                $q->where('category', 'research'));
        }
        if ($user->hasRole('community_officer')) {
            $query->whereHas('budgetRequest.proposal', fn ($q) =>
                $q->where('category', 'community_engagement'));
        }
        if ($user->hasRole('technology_officer')) {
            $query->whereHas('budgetRequest.proposal', fn ($q) =>
                $q->where('category', 'technology_transfer'));
        }

        return response()->json([
            'data'    => $query->get(),
            'message' => '',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'budget_request_id'   => 'required|uuid|exists:budget_requests,id',
            'total_spent'         => 'required|numeric|min:0',
            'unspent_amount'      => 'nullable|numeric|min:0',
            'expense_report_path' => 'nullable|string',
        ]);

        $budgetRequest = BudgetRequest::findOrFail($request->budget_request_id);

        try {
            $settlement = app(BudgetSettlementService::class)->submitSettlement(
                $budgetRequest,
                $request->user(),
                $request->only('total_spent', 'unspent_amount', 'expense_report_path')
            );

            return response()->json([
                'data'    => $settlement->load([
                    'budgetRequest.proposal:id,tracker_number,title',
                    'submittedBy:id,name',
                ]),
                'message' => 'Settlement submitted successfully.',
                'errors'  => [],
                'meta'    => [],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'data'    => null,
                'message' => $e->getMessage(),
                'errors'  => [],
                'meta'    => [],
            ], 422);
        }
    }

    public function show(string $id): JsonResponse
    {
        $settlement = BudgetSettlement::with([
            'budgetRequest.proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'budgetRequest.proposal.college:id,name',
            'budgetRequest.proposal.pi:id,name,email',
            'budgetRequest.items',
            'budgetRequest.disbursements',
            'submittedBy:id,name',
            'collegeVerifiedByUser:id,name',
            'financeVerifiedByUser:id,name',
        ])->findOrFail($id);

        return response()->json([
            'data'    => $settlement,
            'message' => '',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    public function verify(Request $request, string $id): JsonResponse
    {
        $request->validate(['notes' => 'nullable|string']);

        $settlement = BudgetSettlement::findOrFail($id);

        try {
            $updated = app(BudgetSettlementService::class)->verifySettlement(
                $settlement,
                $request->user(),
                $request->input('notes', '')
            );

            return response()->json([
                'data'    => $updated,
                'message' => 'Settlement verified by college.',
                'errors'  => [],
                'meta'    => [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'data'    => null,
                'message' => $e->getMessage(),
                'errors'  => [],
                'meta'    => [],
            ], 422);
        }
    }

    public function finalize(Request $request, string $id): JsonResponse
    {
        $request->validate(['notes' => 'nullable|string']);

        $settlement = BudgetSettlement::findOrFail($id);

        try {
            $updated = app(BudgetSettlementService::class)->finalizeSettlement(
                $settlement,
                $request->user(),
                $request->input('notes', '')
            );

            return response()->json([
                'data'    => $updated,
                'message' => 'Settlement finalized. PI is now eligible for the next funding round.',
                'errors'  => [],
                'meta'    => [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'data'    => null,
                'message' => $e->getMessage(),
                'errors'  => [],
                'meta'    => [],
            ], 422);
        }
    }

    public function pendingSettlements(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = BudgetRequest::with([
            'proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'proposal.college:id,name',
            'proposal.pi:id,name,email',
            'disbursements',
        ])
        ->where('status', 'disbursed')
        ->whereDoesntHave('settlement')
        ->orderBy('updated_at');

        if ($user->hasRole('college_officer') || $user->hasRole('college_officer')) {
            $query->whereHas('proposal', fn ($q) =>
                $q->where('college_id', $user->college_id)
            );
        } elseif (! $user->hasAnyRole(['super_admin', 'central_officer', 'support_officer',
            'research_officer', 'community_officer', 'technology_officer'])) {
            $query->whereHas('proposal', fn ($q) =>
                $q->where('pi_user_id', $user->id)
                  ->orWhereHas('members', fn ($sq) =>
                      $sq->where('user_id', $user->id)->where('status', 'active')
                  )
            );
        }

        $requests = $query->get()->map(function ($br) {
            $br->total_disbursed = $br->disbursements->sum('amount');

            return $br;
        });

        return response()->json([
            'data'    => $requests,
            'message' => '',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    public function uploadExpenseReport(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:10240',
        ]);

        $settlement = BudgetSettlement::findOrFail($id);

        $path = $request->file('file')->store(
            "settlements/{$id}/expense-report",
            'private'
        );

        $settlement->update(['expense_report_path' => $path]);

        return response()->json([
            'data'    => ['path' => $path, 'filename' => $request->file('file')->getClientOriginalName()],
            'message' => 'Expense report uploaded.',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    public function downloadReport(string $id)
    {
        $settlement = BudgetSettlement::findOrFail($id);

        if (! $settlement->expense_report_path) {
            abort(404, 'No expense report uploaded.');
        }

        if (! \Storage::disk('private')->exists($settlement->expense_report_path)) {
            abort(404, 'Expense report file not found.');
        }

        return \Storage::disk('private')->download(
            $settlement->expense_report_path,
            'expense-report-'.$settlement->id.'.pdf'
        );
    }

    public function stats(): JsonResponse
    {
        return response()->json([
            'data' => [
                'total'            => BudgetSettlement::count(),
                'submitted'        => BudgetSettlement::where('status', 'submitted')->count(),
                'college_verified' => BudgetSettlement::where('status', 'college_verified')->count(),
                'finance_verified' => BudgetSettlement::where('status', 'finance_verified')->count(),
            ],
            'message' => '',
            'errors'  => [],
            'meta'    => [],
        ]);
    }
}
