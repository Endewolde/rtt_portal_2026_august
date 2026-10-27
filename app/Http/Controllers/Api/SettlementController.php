<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Services\BudgetSettlementService;
use App\Services\ProgressReportService;
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
            'budgetRequest.proposal.midtermEvaluations:id,proposal_id,status',
            'budgetRequest:id,funding_round,total_amount,proposal_id',
            'submittedBy:id,name,email',
            'collegeVerifiedByUser:id,name',
            'financeVerifiedByUser:id,name',
        ])->orderByDesc('created_at');

        $user->accessScope()->constrainThrough($query, 'budgetRequest.proposal', fn ($q) => $q->whereHas('budgetRequest.proposal', fn ($q) => $q->where('pi_user_id', $user->id)
            ->orWhereHas('members', fn ($sq) => $sq->where('user_id', $user->id)->where('status', 'active'))));

        return response()->json([
            'data' => $query->get(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'budget_request_id' => 'required|uuid|exists:budget_requests,id',
            'total_spent' => 'required|numeric|min:0',
            'unspent_amount' => 'nullable|numeric|min:0',
        ]);

        $budgetRequest = BudgetRequest::with('proposal')->findOrFail($request->budget_request_id);

        // Only the project's own team settles its spending, and only once per request.
        if (! $budgetRequest->proposal || ! app(ProgressReportService::class)->isTeamMember($budgetRequest->proposal, $request->user())) {
            return response()->json(['data' => null, 'message' => 'Only the project team can settle this request.', 'errors' => [], 'meta' => []], 403);
        }
        if (BudgetSettlement::where('budget_request_id', $budgetRequest->id)->exists()) {
            return response()->json(['data' => null, 'message' => 'This request has already been settled.', 'errors' => [], 'meta' => []], 422);
        }

        try {
            // The expense report is attached through the upload endpoint, never as a client-given path.
            $settlement = app(BudgetSettlementService::class)->submitSettlement(
                $budgetRequest,
                $request->user(),
                $request->only('total_spent', 'unspent_amount')
            );

            return response()->json([
                'data' => $settlement->load([
                    'budgetRequest.proposal:id,tracker_number,title',
                    'submittedBy:id,name',
                ]),
                'message' => 'Settlement submitted successfully.',
                'errors' => [],
                'meta' => [],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
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
            'data' => $settlement,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function verify(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user->can('settlements.verify_college')) {
            return response()->json(['message' => 'You do not have permission to verify settlements.', 'errors' => []], 403);
        }

        $request->validate(['notes' => 'nullable|string']);

        $settlement = BudgetSettlement::with('budgetRequest.proposal')->findOrFail($id);

        if (! $user->accessScope()->covers($settlement->budgetRequest?->proposal?->college_id, $settlement->budgetRequest?->proposal?->category)) {
            return response()->json(['message' => 'You can only verify settlements for proposals in your college.', 'errors' => []], 403);
        }

        try {
            $updated = app(BudgetSettlementService::class)->verifySettlement(
                $settlement,
                $request->user(),
                $request->input('notes', '')
            );

            return response()->json([
                'data' => $updated,
                'message' => 'Settlement verified by college.',
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
            ], 422);
        }
    }

    public function finalize(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user->can('settlements.verify_finance')) {
            return response()->json(['message' => 'You do not have permission to finalize settlements.', 'errors' => []], 403);
        }

        $request->validate(['notes' => 'nullable|string']);

        $settlement = BudgetSettlement::with('budgetRequest.proposal')->findOrFail($id);

        if (! $user->accessScope()->covers($settlement->budgetRequest?->proposal?->college_id, $settlement->budgetRequest?->proposal?->category)) {
            return response()->json(['message' => 'You can only finalize settlements for proposals in your college.', 'errors' => []], 403);
        }

        try {
            $updated = app(BudgetSettlementService::class)->finalizeSettlement(
                $settlement,
                $request->user(),
                $request->input('notes', '')
            );

            return response()->json([
                'data' => $updated,
                'message' => 'Settlement finalized. PI is now eligible for the next funding round.',
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
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

        $user->accessScope()->constrainThrough($query, 'proposal', fn ($q) => $q->whereHas('proposal', fn ($q) => $q->where('pi_user_id', $user->id)
            ->orWhereHas('members', fn ($sq) => $sq->where('user_id', $user->id)->where('status', 'active'))));

        $requests = $query->get()->map(function ($br) {
            $br->total_disbursed = $br->disbursements->sum('amount');

            return $br;
        });

        return response()->json([
            'data' => $requests,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function uploadExpenseReport(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:10240',
        ]);

        $settlement = BudgetSettlement::with('budgetRequest.proposal')->findOrFail($id);
        $proposal = $settlement->budgetRequest?->proposal;

        if (! $proposal || ! app(ProgressReportService::class)->isTeamMember($proposal, $request->user())) {
            return response()->json(['data' => null, 'message' => 'Only the project team can attach the expense report.', 'errors' => [], 'meta' => []], 403);
        }
        if ($settlement->status !== 'submitted') {
            return response()->json(['data' => null, 'message' => 'The report can no longer change once the settlement is verified.', 'errors' => [], 'meta' => []], 422);
        }

        $path = $request->file('file')->store(
            "settlements/{$id}/expense-report",
            'private'
        );

        $settlement->update(['expense_report_path' => $path]);

        return response()->json([
            'data' => ['path' => $path, 'filename' => $request->file('file')->getClientOriginalName()],
            'message' => 'Expense report uploaded.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function downloadReport(Request $request, string $id)
    {
        $settlement = BudgetSettlement::with('budgetRequest.proposal')->findOrFail($id);
        abort_unless($this->canSee($settlement, $request->user()), 403, 'You cannot open this expense report.');

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

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = BudgetSettlement::query();
        $user->accessScope()->constrainThrough($query, 'budgetRequest.proposal', fn ($q) => $q->whereHas('budgetRequest.proposal', fn ($q) => $q->where('pi_user_id', $user->id)
            ->orWhereHas('members', fn ($sq) => $sq->where('user_id', $user->id)->where('status', 'active'))));
        $counts = (clone $query)->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');

        return response()->json([
            'data' => [
                'total' => (int) $counts->sum(),
                'submitted' => (int) ($counts['submitted'] ?? 0),
                'college_verified' => (int) ($counts['college_verified'] ?? 0),
                'finance_verified' => (int) ($counts['finance_verified'] ?? 0),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** The project team, or staff whose scope covers the project. */
    private function canSee(BudgetSettlement $settlement, mixed $user): bool
    {
        $proposal = $settlement->budgetRequest?->proposal;
        if (! $proposal || ! $user) {
            return false;
        }

        return app(ProgressReportService::class)->isTeamMember($proposal, $user)
            || ($user->can('settlements.view_any') && $user->accessScope()->covers($proposal->college_id, $proposal->category));
    }
}
