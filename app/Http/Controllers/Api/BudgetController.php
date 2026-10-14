<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendRawMailJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Models\College;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\User;
use App\Services\BudgetAllocationService;
use App\Services\BudgetRequestService;
use App\Services\BudgetSettlementService;
use App\Services\DisbursementService;
use App\Services\SignatureService;
use App\Support\AuditLogger;
use App\Support\RejectionReasons;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BudgetController extends Controller
{
    public function __construct(
        private BudgetAllocationService $allocationService,
        private BudgetRequestService $requestService,
        private SignatureService $signatureService,
        private DisbursementService $disbursementService,
        private BudgetSettlementService $settlementService
    ) {}

    /** List budget requests scoped to the authenticated user's role. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = BudgetRequest::with([
            'proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'requestedBy:id,name,email',
            'items',
            'signatures.user:id,name,email',
            'disbursements',
        ]);

        $adminRoles = ['super_admin', 'admin', 'central_officer', 'support_officer',
            'college_officer', 'finance_officer',
            'research_officer', 'community_officer', 'technology_officer'];

        if ($user->hasRole('college_officer') ||
            ($user->hasRole('support_officer') && $user->college_id)) {
            $query->whereHas('proposal', fn ($q) => $q->where('college_id', $user->college_id));
        } elseif ($user->hasRole('research_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'research'));
        } elseif ($user->hasRole('community_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'community_engagement'));
        } elseif ($user->hasRole('technology_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'technology_transfer'));
        } elseif (! $user->hasAnyRole($adminRoles)) {
            // PI, staff, and any other non-admin: see requests for proposals they own
            // OR are an active member of OR have a signature on.
            $query->where(function ($q) use ($user) {
                $q->whereHas('proposal', fn ($sq) => $sq->where('pi_user_id', $user->id))
                    ->orWhereHas('proposal.members', fn ($sq) => $sq
                        ->where('user_id', $user->id)
                        ->where('status', 'active'))
                    ->orWhereHas('signatures', fn ($sq) => $sq->where('user_id', $user->id));
            });
        }
        // super_admin / central_office / finance → no filter (see all)

        return response()->json([
            'data' => $query->orderByDesc('created_at')->get(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Single budget request with all relations. */
    public function show(Request $request, string $id): JsonResponse
    {
        $budgetRequest = BudgetRequest::with([
            'proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'requestedBy:id,name,email',
            'formTemplate:id,name',
            'items',
            'signatures.user:id,name,email',
            'disbursements',
            'settlement',
        ])->findOrFail($id);

        if (! $this->budgetRequestVisibleTo($request->user(), $budgetRequest)) {
            return response()->json(['message' => 'Unauthorized.', 'errors' => []], 403);
        }

        return response()->json([
            'data' => $budgetRequest,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Same visibility rule as index()'s query-builder scoping, applied to a single
     * record — kept in sync deliberately since index() lists exactly what show()
     * must also allow opening by direct ID.
     */
    private function budgetRequestVisibleTo(User $user, BudgetRequest $budgetRequest): bool
    {
        if (! $budgetRequest->proposal) {
            return $this->hasAnyBudgetAdminRole($user);
        }

        if ($this->proposalBudgetVisibleTo($user, $budgetRequest->proposal)) {
            return true;
        }

        // A signer who isn't the PI or an active member (e.g. a co-PI removed after
        // signing) still needs to see the request they signed.
        return $budgetRequest->signatures()->where('user_id', $user->id)->exists();
    }

    /**
     * Same visibility rule as above, keyed off the proposal directly — used by the
     * proposal-scoped budget endpoints (summary, list-by-proposal) where there may
     * not be a single BudgetRequest in scope yet.
     */
    private function proposalBudgetVisibleTo(User $user, Proposal $proposal): bool
    {
        if ($user->hasRole('college_officer') ||
            ($user->hasRole('support_officer') && $user->college_id)) {
            return $proposal->college_id === $user->college_id;
        }

        if ($user->hasRole('research_officer')) {
            return $proposal->category === 'research';
        }

        if ($user->hasRole('community_officer')) {
            return $proposal->category === 'community_engagement';
        }

        if ($user->hasRole('technology_officer')) {
            return $proposal->category === 'technology_transfer';
        }

        if ($this->hasAnyBudgetAdminRole($user)) {
            return true;
        }

        // PI, staff, or any other non-admin: owner or active member.
        return $proposal->pi_user_id === $user->id
            || $proposal->members()->where('user_id', $user->id)->where('status', 'active')->exists();
    }

    private function hasAnyBudgetAdminRole(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'support_officer',
            'college_officer', 'finance_officer',
            'research_officer', 'community_officer', 'technology_officer']);
    }

    /** Create a budget request via flat POST /budget-requests (not nested under proposal). */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'proposal_id' => 'required|uuid|exists:proposals,id',
            'form_template_id' => 'required|uuid|exists:form_templates,id',
            'items' => 'required|array|min:1',
            'items.*.category' => 'required|string',
            'items.*.description' => 'required|string',
            'items.*.amount' => 'required|numeric|min:0',
            'items.*.justification' => 'nullable|string',
        ]);

        $proposal = Proposal::findOrFail($request->proposal_id);

        try {
            $budgetRequest = $this->requestService->create(
                $proposal,
                $request->form_template_id,
                $request->items,
                $request->user()
            );
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $this->notifyFinanceOfficers($proposal, $budgetRequest);

        return response()->json([
            'data' => $budgetRequest->load(['items', 'signatures.user']),
            'message' => 'Budget request created. Team members notified to sign.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    /**
     * Update items on a draft budget request.
     * Replaces all items, recalculates total, and resets all signatures to pending.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $budgetRequest = BudgetRequest::findOrFail($id);

        $editableStatuses = ['draft', 'pending_signatures'];
        if (! in_array($budgetRequest->status, $editableStatuses)) {
            return response()->json([
                'data' => null,
                'message' => "Cannot edit a budget request with status '{$budgetRequest->status}'. Only draft requests can be edited.",
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.category' => 'required|string',
            'items.*.description' => 'required|string',
            'items.*.amount' => 'required|numeric|min:0',
            'items.*.justification' => 'nullable|string',
        ]);

        // Validate remaining budget cap
        $totalAmount = collect($request->items)->sum('amount');

        // Round 1 is capped at 50% of the awarded budget (same rule as on create)
        if ($budgetRequest->funding_round === 1) {
            $awardedAmount = (float) \DB::table('awards')
                ->where('proposal_id', $budgetRequest->proposal_id)
                ->value('awarded_amount');

            if ($awardedAmount > 0) {
                $cap = $awardedAmount * 0.5;
                if ((float) $totalAmount > $cap) {
                    return response()->json([
                        'data' => null,
                        'message' => sprintf(
                            'Round 1 is limited to 50%% of the awarded budget (max ETB %s). Requested: ETB %s.',
                            number_format($cap, 2),
                            number_format((float) $totalAmount, 2)
                        ),
                        'errors' => [],
                        'meta' => [],
                    ], 422);
                }
            }
        }

        try {
            $this->requestService->assertWithinRemainingBudget(
                $budgetRequest->proposal_id,
                (float) $totalAmount
            );
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        \DB::transaction(function () use ($budgetRequest, $request, $totalAmount) {
            // Replace items
            $budgetRequest->items()->delete();
            foreach ($request->items as $item) {
                $budgetRequest->items()->create([
                    'category' => $item['category'],
                    'description' => $item['description'],
                    'amount' => $item['amount'],
                    'justification' => $item['justification'] ?? null,
                ]);
            }

            // Reset all signatures to pending so team must re-sign
            $budgetRequest->signatures()->update(['status' => 'pending', 'signed_at' => null]);

            $budgetRequest->update([
                'total_amount' => $totalAmount,
                'status' => 'draft',
            ]);
        });

        return response()->json([
            'data' => $budgetRequest->fresh()->load(['items', 'signatures.user']),
            'message' => 'Budget request updated. Team members must re-sign.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Delete a draft budget request. */
    public function destroy(string $id): JsonResponse
    {
        $budgetRequest = BudgetRequest::findOrFail($id);

        $editableStatuses = ['draft', 'pending_signatures'];
        if (! in_array($budgetRequest->status, $editableStatuses)) {
            return response()->json([
                'data' => null,
                'message' => "Cannot delete a budget request with status '{$budgetRequest->status}'.",
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        \DB::transaction(function () use ($budgetRequest) {
            $budgetRequest->signatures()->delete();
            $budgetRequest->items()->delete();
            $budgetRequest->delete();
        });

        return response()->json([
            'data' => null,
            'message' => 'Budget request deleted.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Budget summary for a proposal: awarded amount, total already spent, remaining.
     * Used by the PI's Create form to show available budget in real time.
     */
    public function budgetSummary(Request $request, string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);

        if (! $this->proposalBudgetVisibleTo($request->user(), $proposal)) {
            return response()->json(['message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $awarded = (float) \DB::table('awards')
            ->where('proposal_id', $proposal->id)
            ->value('awarded_amount');

        $totalSpent = (float) \DB::table('budget_settlements')
            ->join('budget_requests', 'budget_settlements.budget_request_id', '=', 'budget_requests.id')
            ->where('budget_requests.proposal_id', $proposal->id)
            ->where('budget_settlements.status', 'finance_verified')
            ->sum('budget_settlements.total_spent');

        $completedRounds = BudgetRequest::where('proposal_id', $proposal->id)->count();
        $isFirstRound = $completedRounds === 0;

        // Round 1 cap: 50% of award
        $roundOneCap = $awarded > 0 ? round($awarded * 0.5, 2) : null;
        $effectiveCap = $isFirstRound && $roundOneCap !== null
            ? $roundOneCap
            : max(0, $awarded - $totalSpent);

        // Midterm: passed if any evaluation has recommendation = continue
        $midtermPassed = MidtermEvaluation::where('proposal_id', $proposal->id)
            ->where('recommendation', 'continue')
            ->exists();

        $midterm = MidtermEvaluation::where('proposal_id', $proposal->id)
            ->orderByDesc('created_at')
            ->first(['id', 'status', 'recommendation', 'progress_score', 'evaluation_date']);

        $rounds = BudgetRequest::with('settlement')
            ->where('proposal_id', $proposal->id)
            ->orderBy('funding_round')
            ->get()
            ->map(fn ($br) => [
                'funding_round' => $br->funding_round,
                'total_amount' => (float) $br->total_amount,
                'status' => $br->status,
                'total_spent' => $br->settlement ? (float) $br->settlement->total_spent : null,
                'settlement_status' => $br->settlement?->status,
            ]);

        $allocationApproved = BudgetAllocation::where('proposal_id', $proposal->id)
            ->where('allocation_type', 'proposal')
            ->where('status', 'approved')
            ->exists();

        return response()->json([
            'data' => [
                'awarded_amount' => $awarded,
                'total_spent' => $totalSpent,
                'remaining' => max(0, $awarded - $totalSpent),
                'effective_cap' => $effectiveCap,
                'is_first_round' => $isFirstRound,
                'round_one_cap' => $roundOneCap,
                'midterm_passed' => $midtermPassed,
                'midterm' => $midterm,
                'rounds' => $rounds,
                'allocation_approved' => $allocationApproved,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** List budget requests for a specific proposal. */
    public function listRequests(Request $request, string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);

        if (! $this->proposalBudgetVisibleTo($request->user(), $proposal)) {
            return response()->json(['message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $requests = BudgetRequest::with(['items', 'signatures.user', 'disbursements', 'settlement'])
            ->where('proposal_id', $id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $requests,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** List all budget allocations scoped by role. */
    public function allocations(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = BudgetAllocation::with([
            'college:id,name,code',
            'proposal:id,tracker_number,title',
            'allocatedBy:id,name',
        ])->orderByDesc('created_at');

        if ($user->hasAnyRole(['college_officer', 'finance_officer']) ||
            ($user->hasRole('support_officer') && $user->college_id)) {
            $query->where('college_id', $user->college_id);
        } elseif (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'support_officer'])) {
            return response()->json(['data' => [], 'message' => '', 'errors' => [], 'meta' => []]);
        }

        if ($type = $request->query('type')) {
            $query->where('allocation_type', $type);
        }
        if ($year = $request->query('fiscal_year')) {
            $query->where('fiscal_year', $year);
        }

        return response()->json(['data' => $query->get(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /**
     * Per-college summary: total budget from awards, allocated from proposal-level
     * budget_allocations, remaining = total - allocated.
     */
    public function collegesSummary(Request $request): JsonResponse
    {
        $user = $request->user();

        $collegeScope = null;
        if ($user->hasAnyRole(['college_officer', 'finance_officer']) ||
            ($user->hasRole('support_officer') && $user->college_id)) {
            $collegeScope = $user->college_id;
        }

        // Total budget per college = sum of awarded amounts for funded proposals
        $awardTotals = DB::table('awards')
            ->join('proposals', 'proposals.id', '=', 'awards.proposal_id')
            ->join('colleges', 'colleges.id', '=', 'proposals.college_id')
            ->whereIn('proposals.status', ['funded', 'midterm_evaluation', 'completion', 'completed'])
            ->when($collegeScope, fn ($q) => $q->where('proposals.college_id', $collegeScope))
            ->selectRaw('proposals.college_id, colleges.name as college_name, COUNT(proposals.id) as proposal_count, SUM(awards.awarded_amount) as total_budget')
            ->groupBy('proposals.college_id', 'colleges.name')
            ->get()
            ->keyBy('college_id');

        // Allocated per college = sum of proposal-level budget_allocations
        $allocated = BudgetAllocation::where('allocation_type', 'proposal')
            ->when($collegeScope, fn ($q) => $q->where('college_id', $collegeScope))
            ->selectRaw('college_id, SUM(total_amount) as allocated_total, COUNT(*) as allocation_count')
            ->groupBy('college_id')
            ->get()
            ->keyBy('college_id');

        $summary = $awardTotals->map(function ($row) use ($allocated) {
            $alloc = $allocated->get($row->college_id);
            $totalBudget = (float) $row->total_budget;
            $allocatedAmt = $alloc ? (float) $alloc->allocated_total : 0.0;
            $remaining = $totalBudget - $allocatedAmt;

            return [
                'college_id' => $row->college_id,
                'college_name' => $row->college_name,
                'proposal_count' => (int) $row->proposal_count,
                'total_budget' => $totalBudget,
                'allocated_amount' => $allocatedAmt,
                'remaining_balance' => $remaining,
                'allocation_count' => $alloc ? (int) $alloc->allocation_count : 0,
            ];
        })->values();

        return response()->json(['data' => $summary, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** Summary stats for budget allocations. */
    public function allocationStats(Request $request): JsonResponse
    {
        $user = $request->user();

        $collegeScope = null;
        if ($user->hasAnyRole(['college_officer', 'finance_officer']) ||
            ($user->hasRole('support_officer') && $user->college_id)) {
            $collegeScope = $user->college_id;
        }

        // Total budget = sum of awards for funded proposals
        $totalBudget = DB::table('awards')
            ->join('proposals', 'proposals.id', '=', 'awards.proposal_id')
            ->whereIn('proposals.status', ['funded', 'midterm_evaluation', 'completion', 'completed'])
            ->when($collegeScope, fn ($q) => $q->where('proposals.college_id', $collegeScope))
            ->sum('awards.awarded_amount');

        $allocationQuery = BudgetAllocation::where('allocation_type', 'proposal')
            ->when($collegeScope, fn ($q) => $q->where('college_id', $collegeScope));

        $totalAllocated = (float) (clone $allocationQuery)->sum('total_amount');
        $collegesCount = DB::table('proposals')
            ->join('awards', 'awards.proposal_id', '=', 'proposals.id')
            ->whereIn('proposals.status', ['funded', 'midterm_evaluation', 'completion', 'completed'])
            ->when($collegeScope, fn ($q) => $q->where('proposals.college_id', $collegeScope))
            ->distinct()->count('proposals.college_id');

        return response()->json([
            'data' => [
                'colleges_with_budget' => $collegesCount,
                'total_budget' => (float) $totalBudget,
                'total_allocated' => $totalAllocated,
                'total_remaining' => (float) $totalBudget - $totalAllocated,
                'proposal_allocations' => (clone $allocationQuery)->count(),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Funded proposals with award amount and current allocation status.
     * Supports ?academic_year=2026 and ?college_id=uuid filters.
     */
    public function proposalBudgets(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Proposal::whereIn('status', ['funded', 'midterm_evaluation', 'completion', 'completed'])
            ->with([
                'college:id,name',
                'pi:id,name,email',
                'award:id,proposal_id,awarded_amount',
                'budgetAllocations' => fn ($q) => $q->where('allocation_type', 'proposal')
                    ->with('allocatedBy:id,name', 'approvedBy:id,name'),
            ])
            ->orderBy('academic_year', 'desc')
            ->orderBy('college_id')
            ->orderBy('tracker_number');

        // Role-based scoping
        if ($user->hasAnyRole(['college_officer', 'finance_officer']) ||
            ($user->hasRole('support_officer') && $user->college_id)) {
            $query->where('college_id', $user->college_id);
        } elseif ($user->hasRole('research_officer')) {
            $query->where('category', 'research');
        } elseif ($user->hasRole('community_officer')) {
            $query->where('category', 'community_engagement');
        } elseif ($user->hasRole('technology_officer')) {
            $query->where('category', 'technology_transfer');
        } elseif (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'support_officer'])) {
            return response()->json(['data' => [], 'message' => '', 'errors' => [], 'meta' => []]);
        }

        // Optional filters
        if ($year = $request->query('academic_year')) {
            $query->where('academic_year', $year);
        }
        if ($collegeId = $request->query('college_id')) {
            if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
                $query->where('college_id', $collegeId);
            }
        }

        return response()->json(['data' => $query->get(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** Funded proposals in a college available for budget allocation. */
    public function fundedProposalsForAllocation(string $collegeId): JsonResponse
    {
        $proposals = Proposal::where('college_id', $collegeId)
            ->whereIn('status', ['funded', 'midterm_evaluation'])
            ->with(['pi:id,name', 'award:id,proposal_id,awarded_amount'])
            ->orderBy('tracker_number')
            ->get(['id', 'tracker_number', 'title', 'pi_user_id', 'category', 'college_id']);

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** One-click: create a pending allocation from the proposal's full award amount. */
    public function quickAllocate(string $proposalId, Request $request): JsonResponse
    {
        $request->validate(['fiscal_year' => 'required|string|max:20']);

        $proposal = Proposal::with('award')->findOrFail($proposalId);

        try {
            $allocation = $this->allocationService->quickAllocateFromAward(
                $proposal, $request->user(), $request->fiscal_year
            );

            return response()->json([
                'data' => $allocation->load(['proposal:id,tracker_number,title', 'allocatedBy:id,name']),
                'message' => 'Allocation created and pending approval.',
                'errors' => [],
                'meta' => [],
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    /** Approve a single budget allocation. Only central/category officers — not college officers. */
    public function approveAllocation(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $allocation = BudgetAllocation::with('proposal:id,category')->findOrFail($id);
        $category = $allocation->proposal?->category;

        if (! $this->userCanApproveCategory($user, $category)) {
            return response()->json([
                'data' => null,
                'message' => 'You do not have permission to approve this allocation.',
                'errors' => [],
                'meta' => [],
            ], 403);
        }

        try {
            $approved = $this->allocationService->approve($allocation, $user);

            return response()->json([
                'data' => $approved->load(['college:id,name', 'proposal:id,tracker_number', 'approvedBy:id,name']),
                'message' => 'Budget allocation approved.',
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    /** Bulk approve — filtered to only allocations in the user's allowed categories. */
    public function bulkApproveAllocations(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'nullable|array',
            'ids.*' => 'uuid',
            'college_id' => 'nullable|uuid|exists:colleges,id',
        ]);

        $user = $request->user();
        $ids = $request->input('ids', []);

        // If college_id provided, pull all pending IDs for that college
        if ($request->college_id) {
            $extra = BudgetAllocation::where('college_id', $request->college_id)
                ->where('allocation_type', 'proposal')
                ->where('status', 'pending')
                ->pluck('id')
                ->toArray();
            $ids = array_unique(array_merge($ids, $extra));
        }

        // Filter to only IDs in categories the user is allowed to approve
        $allowed = BudgetAllocation::whereIn('id', $ids)
            ->where('status', 'pending')
            ->join('proposals', 'proposals.id', '=', 'budget_allocations.proposal_id')
            ->get(['budget_allocations.id', 'proposals.category'])
            ->filter(fn ($row) => $this->userCanApproveCategory($user, $row->category))
            ->pluck('id')
            ->toArray();

        $count = $this->allocationService->bulkApprove($allowed, $user);

        return response()->json([
            'data' => ['approved' => $count],
            'message' => "{$count} allocation(s) approved.",
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * True if the user's role allows approving allocations for proposals in $category.
     * College officers are NOT allowed to approve.
     */
    private function userCanApproveCategory(mixed $user, ?string $category): bool
    {
        if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
            return true;
        }

        return match ($category) {
            'research' => $user->hasRole('research_officer'),
            'community_engagement' => $user->hasRole('community_officer'),
            'technology_transfer' => $user->hasRole('technology_officer'),
            default => false,
        };
    }

    /** Update amount/notes on a pending or approved allocation. */
    public function updateAllocation(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'amount' => 'nullable|numeric|min:1',
            'notes' => 'nullable|string',
        ]);

        $allocation = BudgetAllocation::findOrFail($id);

        try {
            $updated = $this->allocationService->updateAllocation(
                $allocation,
                (float) ($request->amount ?? $allocation->total_amount),
                $request->input('notes')
            );

            return response()->json([
                'data' => $updated->load(['college:id,name', 'proposal:id,tracker_number,title', 'allocatedBy:id,name']),
                'message' => 'Allocation updated.',
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    /** Distinct fiscal years that have allocations. */
    public function fiscalYears(): JsonResponse
    {
        $years = BudgetAllocation::distinct()->orderByDesc('fiscal_year')->pluck('fiscal_year');

        return response()->json(['data' => $years, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function allocateToCollege(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
            'fiscal_year' => 'required|string|max:20',
            'notes' => 'nullable|string',
        ]);

        $college = College::findOrFail($id);
        $allocation = $this->allocationService->allocateToCollege(
            $college, (float) $request->amount, $request->fiscal_year, $request->user(), $request->input('notes')
        );

        return response()->json(['data' => $allocation->load(['college:id,name', 'allocatedBy:id,name'])], 201);
    }

    public function allocateToProposal(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
            'fiscal_year' => 'required|string|max:20',
            'notes' => 'nullable|string',
        ]);

        $proposal = Proposal::findOrFail($id);
        $allocation = $this->allocationService->allocateToProposal(
            $proposal, (float) $request->amount, $request->fiscal_year, $request->user(), $request->input('notes')
        );

        return response()->json(['data' => $allocation->load(['proposal:id,tracker_number,title', 'college:id,name', 'allocatedBy:id,name'])], 201);
    }

    public function createRequest(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'form_template_id' => 'required|string',
            'items' => 'required|array|min:1',
        ]);

        $proposal = Proposal::findOrFail($id);
        $budgetRequest = $this->requestService->create(
            $proposal, $request->form_template_id, $request->items, $request->user()
        );

        return response()->json(['data' => $budgetRequest], 201);
    }

    public function submitRequest(string $id, Request $request): JsonResponse
    {
        $budgetRequest = BudgetRequest::findOrFail($id);
        $submitted = $this->requestService->submit($budgetRequest, $request->user());

        return response()->json(['data' => $submitted]);
    }

    public function sign(string $id, Request $request): JsonResponse
    {
        $budgetRequest = BudgetRequest::findOrFail($id);
        $signature = $this->signatureService->sign(
            $budgetRequest, $request->user(), $request->ip()
        );

        return response()->json(['data' => $signature]);
    }

    public function refuse(string $id, Request $request): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:5']);

        $budgetRequest = BudgetRequest::findOrFail($id);
        $signature = $this->signatureService->refuse(
            $budgetRequest, $request->user(), $request->reason, $request->ip()
        );

        return response()->json(['data' => $signature]);
    }

    /**
     * College officer: approve submitted/finance_returned → college_approved.
     * Finance officer / admin: approve college_approved → approved (final).
     */
    public function approve(string $id, Request $request): JsonResponse
    {
        $user = $request->user();

        $budgetRequest = BudgetRequest::with(['proposal', 'proposal.pi', 'proposal.members.user', 'proposal.college'])->findOrFail($id);

        // ── College officer: first-stage approval ──────────────────────────
        if ($user->hasRole('college_officer')) {
            if ($budgetRequest->proposal?->college_id !== $user->college_id) {
                return response()->json(['message' => 'You can only approve budget requests for proposals in your college.', 'errors' => []], 403);
            }

            if (! in_array($budgetRequest->status, ['submitted', 'finance_returned'])) {
                return response()->json(['message' => "Cannot approve a request with status '{$budgetRequest->status}'."], 422);
            }

            $budgetRequest->update([
                'status' => 'college_approved',
                'college_approved_at' => now(),
                'college_review_notes' => $request->input('notes'),
            ]);

            AuditLogger::log('budget.college_approved', BudgetRequest::class, $budgetRequest->id, $user->id,
                ['status' => $budgetRequest->getOriginal('status')], ['status' => 'college_approved']);

            $this->notifyCollegeApproval($budgetRequest->fresh()->load(['proposal.pi', 'proposal.members.user']));

            return response()->json(['data' => $budgetRequest->fresh(), 'message' => 'Budget request approved by college. Forwarded to Finance Officer.']);
        }

        // ── Finance officer / admin: final approval ────────────────────────
        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'finance_officer', 'support_officer'])) {
            return response()->json(['message' => 'You do not have permission to approve budget requests.', 'errors' => []], 403);
        }

        if ($user->hasRole('finance_officer') && $budgetRequest->proposal?->college_id !== $user->college_id) {
            return response()->json(['message' => 'You can only approve budget requests for proposals in your college.', 'errors' => []], 403);
        }

        if ($budgetRequest->status !== 'college_approved') {
            return response()->json(['message' => "Budget request must be college-approved before finance approval. Current status: '{$budgetRequest->status}'."], 422);
        }

        $budgetRequest->update([
            'status' => 'approved',
            'approved_at' => now(),
        ]);

        AuditLogger::log('budget.request_approved', BudgetRequest::class, $budgetRequest->id, $user->id,
            ['status' => 'college_approved'], ['status' => 'approved', 'tracker' => $budgetRequest->proposal?->tracker_number]);

        $this->notifyBudgetRequestApproved($budgetRequest->fresh()->load(['proposal.pi', 'proposal.members.user']));

        return response()->json(['data' => $budgetRequest->fresh(), 'message' => 'Budget request approved. PI and members have been notified to collect funds.']);
    }

    /**
     * College officer: reject submitted/finance_returned → rejected.
     * Notifies PI and co-investigators with the rejection reason.
     */
    public function rejectByCollege(string $id, Request $request): JsonResponse
    {
        RejectionReasons::apply($request, 'budget_request', 'notes');
        $request->validate(['notes' => 'required|string|min:10']);

        $user = $request->user();

        if (! $user->hasRole('college_officer')) {
            return response()->json(['message' => 'Only a college officer can reject budget requests.', 'errors' => []], 403);
        }

        $budgetRequest = BudgetRequest::with(['proposal', 'proposal.pi', 'proposal.members.user'])->findOrFail($id);

        if ($budgetRequest->proposal?->college_id !== $user->college_id) {
            return response()->json(['message' => 'You can only reject budget requests for proposals in your college.', 'errors' => []], 403);
        }

        if (! in_array($budgetRequest->status, ['submitted', 'finance_returned'])) {
            return response()->json(['message' => "Cannot reject a request with status '{$budgetRequest->status}'."], 422);
        }

        $budgetRequest->update([
            'status' => 'rejected',
            'rejection_reason' => $request->input('notes'),
        ]);

        AuditLogger::log('budget.college_rejected', BudgetRequest::class, $budgetRequest->id, $user->id,
            ['status' => $budgetRequest->getOriginal('status')], ['status' => 'rejected']);

        $this->notifyCollegeRejection($budgetRequest->fresh()->load(['proposal.pi', 'proposal.members.user']));

        return response()->json(['data' => $budgetRequest->fresh(), 'message' => 'Budget request rejected. PI and members have been notified.']);
    }

    /**
     * Finance officer: return college_approved → finance_returned with notes.
     * Notifies the college officer.
     */
    public function returnByFinance(string $id, Request $request): JsonResponse
    {
        $request->validate(['notes' => 'required|string|min:10']);

        $user = $request->user();

        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'finance_officer'])) {
            return response()->json(['message' => 'Only a finance officer can return budget requests.', 'errors' => []], 403);
        }

        $budgetRequest = BudgetRequest::with(['proposal', 'proposal.pi', 'proposal.members.user'])->findOrFail($id);

        if ($user->hasRole('finance_officer') && $budgetRequest->proposal?->college_id !== $user->college_id) {
            return response()->json(['message' => 'You can only return budget requests for proposals in your college.', 'errors' => []], 403);
        }

        if ($budgetRequest->status !== 'college_approved') {
            return response()->json(['message' => "Can only return a college-approved request. Current status: '{$budgetRequest->status}'."], 422);
        }

        $budgetRequest->update([
            'status' => 'finance_returned',
            'finance_notes' => $request->input('notes'),
            'finance_returned_at' => now(),
        ]);

        AuditLogger::log('budget.finance_returned', BudgetRequest::class, $budgetRequest->id, $user->id,
            ['status' => 'college_approved'], ['status' => 'finance_returned']);

        $this->notifyFinanceReturn($budgetRequest->fresh()->load(['proposal', 'proposal.college']));

        return response()->json(['data' => $budgetRequest->fresh(), 'message' => 'Budget request returned to college officer with notes.']);
    }

    private function notifyCollegeApproval(BudgetRequest $budgetRequest): void
    {
        $proposal = $budgetRequest->proposal;
        if (! $proposal) {
            return;
        }

        // Notify finance officers in this college
        $financeOfficers = User::role('finance_officer')
            ->where('college_id', $proposal->college_id)
            ->get();

        if ($financeOfficers->isEmpty()) {
            $financeOfficers = User::role(['super_admin', 'admin', 'central_officer'])->get();
        }

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'round_number' => $budgetRequest->funding_round,
            'requested_amount' => $budgetRequest->total_amount,
            'notes' => $budgetRequest->college_review_notes,
        ];

        foreach ($financeOfficers as $officer) {
            if (! $officer->email) {
                continue;
            }
            SendRawMailJob::dispatchSync(
                "<p>Dear {$officer->name},</p><p>Budget request for <strong>{$proposal->title}</strong> ({$proposal->tracker_number}) — Round {$budgetRequest->funding_round} — has been approved by the college officer and is now awaiting your review.</p><p>Amount requested: ETB ".number_format((float) $budgetRequest->total_amount, 2).'</p>',
                $officer->email,
                $officer->name,
                "Budget Request Awaiting Finance Approval — {$proposal->tracker_number}"
            );
            try {
                StoreInAppNotificationJob::dispatchSync($officer->id, 'budget_request_approved', $data);
            } catch (\Exception $e) {
                Log::error("Budget college-approval notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyCollegeRejection(BudgetRequest $budgetRequest): void
    {
        $proposal = $budgetRequest->proposal;
        if (! $proposal) {
            return;
        }

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'round_number' => $budgetRequest->funding_round,
            'notes' => $budgetRequest->rejection_reason,
        ];

        $recipients = collect();
        if ($proposal->pi) {
            $recipients->push($proposal->pi);
        }
        $proposal->members
            ->where('role', 'co_investigator')
            ->where('status', 'active')
            ->each(fn ($m) => $m->user && $recipients->push($m->user));

        foreach ($recipients->unique('id') as $user) {
            if (! $user->email) {
                continue;
            }
            SendRawMailJob::dispatchSync(
                "<p>Dear {$user->name},</p><p>Your budget request for <strong>{$proposal->title}</strong> ({$proposal->tracker_number}) — Round {$budgetRequest->funding_round} — has been <strong>rejected</strong> by the college officer.</p><p><strong>Reason:</strong> {$budgetRequest->rejection_reason}</p><p>Please review the feedback, make the necessary corrections, and resubmit when ready.</p>",
                $user->email,
                $user->name,
                "Budget Request Rejected — {$proposal->tracker_number}"
            );
            try {
                StoreInAppNotificationJob::dispatchSync($user->id, 'budget_request_approved', $data);
            } catch (\Exception $e) {
                Log::error("Budget college-rejection notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyFinanceReturn(BudgetRequest $budgetRequest): void
    {
        $proposal = $budgetRequest->proposal;
        if (! $proposal) {
            return;
        }

        $collegeOfficers = User::role('college_officer')
            ->where('college_id', $proposal->college_id)
            ->get();

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'round_number' => $budgetRequest->funding_round,
            'notes' => $budgetRequest->finance_notes,
        ];

        foreach ($collegeOfficers as $officer) {
            if (! $officer->email) {
                continue;
            }
            SendRawMailJob::dispatchSync(
                "<p>Dear {$officer->name},</p><p>The budget request for <strong>{$proposal->title}</strong> ({$proposal->tracker_number}) — Round {$budgetRequest->funding_round} — has been <strong>returned</strong> by the Finance Officer with the following notes:</p><p><strong>Finance Notes:</strong> {$budgetRequest->finance_notes}</p><p>Please review and take appropriate action (approve again or reject to PI).</p>",
                $officer->email,
                $officer->name,
                "Budget Request Returned by Finance — {$proposal->tracker_number}"
            );
            try {
                StoreInAppNotificationJob::dispatchSync($officer->id, 'budget_request_approved', $data);
            } catch (\Exception $e) {
                Log::error("Budget finance-return notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyBudgetRequestApproved(BudgetRequest $budgetRequest): void
    {
        $proposal = $budgetRequest->proposal;
        if (! $proposal) {
            return;
        }

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'round_number' => $budgetRequest->funding_round,
            'requested_amount' => $budgetRequest->total_requested ?? null,
            'notes' => $budgetRequest->college_review_notes,
        ];

        $recipients = collect();

        if ($proposal->pi) {
            $recipients->push($proposal->pi);
        }

        $proposal->members
            ->where('role', 'co_investigator')
            ->where('status', 'active')
            ->each(fn ($m) => $m->user && $recipients->push($m->user));

        foreach ($recipients->unique('id') as $user) {
            if (! $user->email) {
                continue;
            }
            SendRawMailJob::dispatchSync(
                view('emails.notifications.budget_request_approved', array_merge($data, ['recipient' => $user]))->render(),
                $user->email,
                $user->name,
                "Budget Request Approved — {$proposal->tracker_number}"
            );

            // Store in-app notification
            try {
                StoreInAppNotificationJob::dispatchSync($user->id, 'budget_request_approved', $data);
            } catch (\Exception $e) {
                Log::error("Budget request-approved notify failed: {$e->getMessage()}");
            }
        }
    }

    public function disburse(string $id, Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'finance_officer', 'support_officer'])) {
            return response()->json(['message' => 'You do not have permission to disburse funds.', 'errors' => []], 403);
        }

        $request->validate(['amount' => 'required|numeric|min:0.01']);

        $budgetRequest = BudgetRequest::with('proposal')->findOrFail($id);

        $disbursement = $this->disbursementService->disburse(
            $budgetRequest, (float) $request->amount, $request->only(['transaction_id', 'cheque_number', 'notes']), $request->user()
        );

        AuditLogger::log(
            'budget.disbursed',
            BudgetRequest::class,
            $budgetRequest->id,
            $request->user()->id,
            null,
            ['amount' => $request->amount, 'tracker' => $budgetRequest->proposal?->tracker_number],
        );

        return response()->json(['data' => $disbursement], 201);
    }

    public function submitSettlement(string $id, Request $request): JsonResponse
    {
        $request->validate(['total_spent' => 'required|numeric|min:0']);

        $budgetRequest = BudgetRequest::findOrFail($id);
        $settlement = $this->settlementService->submitSettlement(
            $budgetRequest, $request->user(), $request->all()
        );

        AuditLogger::log(
            'budget.settlement_submitted',
            BudgetRequest::class,
            $budgetRequest->id,
            $request->user()->id,
            null,
            ['total_spent' => $request->total_spent, 'tracker' => $budgetRequest->proposal?->tracker_number],
        );

        return response()->json(['data' => $settlement], 201);
    }

    public function verifySettlement(string $id, Request $request): JsonResponse
    {
        $settlement = BudgetSettlement::findOrFail($id);
        $verified = $this->settlementService->verifySettlement(
            $settlement, $request->user(), $request->input('notes', '')
        );

        AuditLogger::log(
            'budget.settlement_verified',
            BudgetSettlement::class,
            $settlement->id,
            $request->user()->id,
            ['status' => 'submitted'],
            ['status' => 'verified'],
        );

        return response()->json(['data' => $verified]);
    }

    public function finalizeSettlement(string $id, Request $request): JsonResponse
    {
        $settlement = BudgetSettlement::findOrFail($id);
        $finalized = $this->settlementService->finalizeSettlement(
            $settlement, $request->user(), $request->input('notes', '')
        );

        AuditLogger::log(
            'budget.settlement_finalized',
            BudgetSettlement::class,
            $settlement->id,
            $request->user()->id,
            ['status' => 'verified'],
            ['status' => 'finalized'],
        );

        return response()->json(['data' => $finalized]);
    }

    private function notifyFinanceOfficers(Proposal $proposal, BudgetRequest $budgetRequest): void
    {
        $officers = User::role('finance_officer')->where('status', 'active')->get();
        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'total_amount' => $budgetRequest->total_amount,
            'pi_name' => $proposal->pi?->name ?? 'Unknown',
        ];

        foreach ($officers as $officer) {
            try {
                SendEmailNotificationJob::dispatchSync($officer, 'budget_request_submitted', $data);
                StoreInAppNotificationJob::dispatchSync($officer->id, 'budget_request_submitted', $data);
            } catch (\Exception $e) {
                Log::error("Finance officer notify failed: {$e->getMessage()}");
            }
        }
    }
}
