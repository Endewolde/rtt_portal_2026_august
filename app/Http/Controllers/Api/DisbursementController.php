<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetRequest;
use App\Models\Disbursement;
use App\Services\DisbursementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DisbursementController extends Controller
{
    public function __construct(private DisbursementService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Disbursement::with([
            'budgetRequest.proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'budgetRequest.proposal.college:id,name',
            'budgetRequest.proposal.pi:id,name,email',
            'disbursedBy:id,name',
            'paymentProofs',
        ])->orderByDesc('disbursed_at');

        $adminRoles = ['super_admin', 'central_officer', 'support_officer',
            'research_officer', 'community_officer', 'technology_officer'];

        if ($user->hasRole('college_officer')) {
            $query->whereHas('budgetRequest.proposal', fn ($q) => $q->where('college_id', $user->college_id));
        } elseif ($user->hasRole('research_officer')) {
            $query->whereHas('budgetRequest.proposal', fn ($q) => $q->where('category', 'research'));
        } elseif ($user->hasRole('community_officer')) {
            $query->whereHas('budgetRequest.proposal', fn ($q) => $q->where('category', 'community_engagement'));
        } elseif ($user->hasRole('technology_officer')) {
            $query->whereHas('budgetRequest.proposal', fn ($q) => $q->where('category', 'technology_transfer'));
        } elseif (! $user->hasAnyRole($adminRoles)) {
            // PI / staff / co-investigator
            $query->whereHas('budgetRequest.proposal', function ($q) use ($user) {
                $q->where('pi_user_id', $user->id)
                    ->orWhereHas('members', fn ($sq) => $sq
                        ->where('user_id', $user->id)
                        ->where('status', 'active'));
            });
        }

        $paginated = $query->paginate(25);

        return response()->json([
            'data' => $paginated->items(),
            'message' => '',
            'errors' => [],
            'meta' => [
                'total' => $paginated->total(),
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'budget_request_id' => 'required|uuid|exists:budget_requests,id',
            'amount' => 'required|numeric|min:0.01',
            'transaction_id' => 'nullable|string|max:200',
            'cheque_number' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $budgetRequest = BudgetRequest::findOrFail($request->budget_request_id);

        $disbursement = $this->service->disburse(
            $budgetRequest,
            (float) $request->amount,
            $request->only('transaction_id', 'cheque_number', 'notes'),
            $request->user()
        );

        return response()->json([
            'data' => $disbursement->load(['budgetRequest.proposal', 'disbursedBy']),
            'message' => 'Funds disbursed successfully.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $disbursement = Disbursement::with([
            'budgetRequest.proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'budgetRequest.proposal.pi:id,name,email',
            'budgetRequest.proposal.college:id,name',
            'budgetRequest.items',
            'disbursedBy:id,name',
            'paymentProofs',
        ])->findOrFail($id);

        return response()->json([
            'data' => $disbursement,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Approved budget requests that still have undisbursed balance. */
    public function pendingApproved(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = BudgetRequest::with([
            'proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'proposal.pi:id,name,email',
            'proposal.college:id,name',
            'items',
            'disbursements',
        ])->where('status', 'approved')->orderBy('approved_at');

        if ($user->hasRole('college_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('college_id', $user->college_id));
        } elseif ($user->hasRole('research_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'research'));
        } elseif ($user->hasRole('community_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'community_engagement'));
        } elseif ($user->hasRole('technology_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'technology_transfer'));
        }

        $requests = $query->get()->map(function ($br) {
            $disbursed = (float) $br->disbursements->sum('amount');
            $br->disbursed_amount = $disbursed;
            $br->remaining_amount = max(0, (float) $br->total_amount - $disbursed);
            $br->disbursement_complete = $br->remaining_amount <= 0;

            return $br;
        });

        return response()->json([
            'data' => $requests,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Disbursement::query();

        if ($user->hasRole('college_officer')) {
            $query->whereHas('budgetRequest.proposal', fn ($q) => $q->where('college_id', $user->college_id));
        }

        $totalDisbursed = (clone $query)->sum('amount');
        $thisMonth = (clone $query)
            ->whereMonth('disbursed_at', now()->month)
            ->whereYear('disbursed_at', now()->year)
            ->sum('amount');

        return response()->json([
            'data' => [
                'total_disbursed' => (float) $totalDisbursed,
                'this_month' => (float) $thisMonth,
                'pending_count' => BudgetRequest::where('status', 'approved')->count(),
                'disbursement_count' => (clone $query)->count(),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
