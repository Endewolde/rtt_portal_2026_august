<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\OverBudgetException;
use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\AwardService;
use App\Services\FundingBudgetService;
use App\Services\FundingDecisionService;
use App\Services\ReviewScoreService;
use App\Services\WorkflowService;
use App\Support\RejectionReasons;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CentralEvaluationController extends Controller
{
    public function __construct(
        private WorkflowService $workflowService,
        private ReviewScoreService $scoreService,
        private FundingBudgetService $fundingBudget,
        private AwardService $awardService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('awards.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $query = Proposal::where('status', 'accepted')
            ->with([
                'proposalCall:id,title,funding_budget',
                'pi:id,name,email',
                'college:id,name',
                'reviewAssignments.evaluationType.categories.questions',
                'reviewAssignments.scores',
                'budgets',
            ])
            ->orderByDesc('updated_at');

        if ($request->_category_scope) {
            $query->where('category', $request->_category_scope);
        }

        if ($request->_college_scope) {
            $query->where('college_id', $request->_college_scope);
        }

        $budgets = [];
        $proposals = $query->get()
            ->map(function (Proposal $p) use (&$budgets, $request) {
                // Live recalculation against CURRENT threshold settings and CURRENT
                // evaluation-criteria weights — never cached, so this list is always
                // up to date even if thresholds/criteria changed after the proposal's
                // automatic blind/defence decision.
                $snapshot = $this->scoreService->recalculateSnapshot($p);

                $budgetTotal = $p->budgets->sum('amount');
                $reviewers = $p->reviewAssignments->where('status', 'submitted');

                // The scores are summarised below; the raw assignments, questions and
                // budget lines are not sent to the browser.
                return array_merge($p->makeHidden(['reviewAssignments', 'budgets'])->toArray(), [
                    'skips_defence' => $snapshot['skips_defence'] ?? false,
                    'blind_reviewers' => $reviewers->filter(fn ($a) => str_starts_with($a->evaluationType?->name ?? '', 'blind_review') && ! $a->set_aside_at)->count(),
                    'defence_reviewers' => $reviewers->filter(fn ($a) => str_starts_with($a->evaluationType?->name ?? '', 'open_defence'))->count(),
                    'blind_score_raw' => $snapshot['blind']['score'] ?? null,
                    'blind_max' => $snapshot['blind']['max'] ?? null,
                    'defence_score_raw' => $snapshot['defence']['score'] ?? null,
                    'defence_max' => $snapshot['defence']['max'] ?? null,
                    'combined_score' => $snapshot['combined'],
                    'total_max' => $snapshot['combined_max'],
                    'threshold_pct' => $snapshot['combined_threshold'],
                    'threshold' => $snapshot['combined_threshold'],
                    'defence_threshold' => $snapshot['defence_threshold'],
                    'defence_below_threshold' => $snapshot['defence_below_threshold'],
                    'decision_mode' => $snapshot['decision_mode'],
                    'budget_total' => $budgetTotal,
                    // College-level deciders spend their college's share of the call, not the whole call.
                    'call_budget' => $p->proposalCall
                        ? ($budgets[$p->proposal_call_id.'|'.$p->college_id] ??= ['call_title' => $p->proposalCall->title.($request->_college_scope ? ' · your college\'s share' : '')]
                            + ($request->_college_scope ? $this->fundingBudget->collegeSummary($p->proposalCall, (string) $p->college_id) : $this->fundingBudget->summary($p->proposalCall)))
                        : null,
                ]);
            });

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** Proposals awaiting the central decision, per call, ranked by combined score against the call's budget. */
    public function meritList(Request $request): JsonResponse
    {
        if (! $request->user()?->can('awards.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $scope = ['college_id' => $request->_college_scope, 'category' => $request->_category_scope];

        $calls = ProposalCall::whereIn('id', Proposal::where('status', 'accepted')
            ->when($scope['college_id'], fn ($q, $id) => $q->where('college_id', $id))
            ->when($scope['category'], fn ($q, $c) => $q->where('category', $c))
            ->select('proposal_call_id'))
            ->orderByDesc('academic_year')
            ->get();

        return response()->json([
            'data' => $calls->map(fn (ProposalCall $call) => $this->fundingBudget->meritList($call, $scope))->values(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function centralApprove(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'awarded_amount' => 'required|numeric|min:1',
            'remarks' => 'nullable|string|max:2000',
        ]);

        $proposal = Proposal::with('proposalCall')->findOrFail($id);

        if ($denied = $this->outOfScope($request, $proposal)) {
            return $denied;
        }

        try {
            [$updated, $award] = app(FundingDecisionService::class)->approve(
                $proposal, $request->user(), (float) $request->awarded_amount, $request->remarks,
            );
        } catch (OverBudgetException $e) {
            return response()->json([
                'data' => ['remaining' => $e->remaining, 'over_by' => $e->overBy],
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => ['code' => 'over_budget'],
            ], 422);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        return response()->json([
            'data' => ['status' => $updated->status, 'grant_reference' => $award->grant_reference],
            'message' => 'Proposal approved for funding. Grant: '.$award->grant_reference,
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function centralReject(Request $request, string $id): JsonResponse
    {
        RejectionReasons::apply($request, 'central_evaluation');
        $request->validate(['reason' => 'required|string|min:10']);

        $proposal = Proposal::findOrFail($id);

        if ($denied = $this->outOfScope($request, $proposal)) {
            return $denied;
        }

        try {
            $updated = app(FundingDecisionService::class)->reject($proposal, $request->user(), $request->reason);

            return response()->json([
                'data' => ['status' => $updated->status],
                'message' => 'Proposal rejected.',
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

    /** PI funding history: overlap detection, past awards, and co-investigator activity. */
    public function piFundingHistory(Request $request, string $userId): JsonResponse
    {
        if (! $request->user()?->can('awards.view')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $pi = User::select('id', 'name', 'email')->findOrFail($userId);

        // Proposals where this user is the PI
        $asPi = Proposal::where('pi_user_id', $userId)
            ->with(['award:id,proposal_id,grant_reference,awarded_amount,approved_at', 'college:id,name'])
            ->orderByDesc('created_at')
            ->get(['id', 'tracker_number', 'title', 'status', 'category', 'college_id', 'created_at']);

        // Running projects — funded or already at midterm — both count as holding funding.
        $activeFunded = $asPi->whereIn('status', ['funded', 'midterm_evaluation'])->values();
        $historicalFunded = $asPi->where('status', 'funded')->values(); // same for now; extend if you add 'completed'

        // Proposals where this user is a co-investigator (any active/funded)
        $asCoInv = Proposal::whereHas('members', fn ($q) => $q->where('user_id', $userId)->where('role', 'co_investigator'))
            ->whereIn('status', ['funded', 'midterm_evaluation'])
            ->with(['college:id,name'])
            ->get(['id', 'tracker_number', 'title', 'status', 'category', 'college_id']);

        $totalAwarded = $asPi->whereNotNull('award')->sum(fn ($p) => (float) ($p->award?->awarded_amount ?? 0));
        $fundedCount = $asPi->whereIn('status', ['funded', 'midterm_evaluation', 'completed', 'archived'])->count();

        return response()->json([
            'data' => [
                'pi' => $pi,
                'has_overlap' => $activeFunded->count() > 0,
                'active_funded' => $activeFunded->map(fn ($p) => [
                    'id' => $p->id,
                    'tracker_number' => $p->tracker_number,
                    'title' => $p->title,
                    'category' => $p->category,
                    'college' => $p->college?->name,
                    'grant_reference' => $p->award?->grant_reference,
                    'awarded_amount' => $p->award?->awarded_amount,
                    'approved_at' => $p->award?->approved_at,
                ]),
                'co_investigator_on' => $asCoInv->map(fn ($p) => [
                    'id' => $p->id,
                    'tracker_number' => $p->tracker_number,
                    'title' => $p->title,
                    'college' => $p->college?->name,
                ]),
                'stats' => [
                    'total_funded_as_pi' => $fundedCount,
                    'total_awarded_etb' => $totalAwarded,
                    'co_investigator_active_count' => $asCoInv->count(),
                ],
            ],
            'message' => '',
            'errors' => [],
        ]);
    }

    /** Revoke funding for a funded proposal and move it back to rejected. */
    public function revokeFunding(Request $request, string $id): JsonResponse
    {
        RejectionReasons::apply($request, 'funding_revocation');
        $request->validate(['reason' => 'required|string|min:10']);

        if (! $request->user()?->can('funding.revoke')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $proposal = Proposal::findOrFail($id);

        if ($denied = $this->outOfScope($request, $proposal)) {
            return $denied;
        }

        if ($proposal->status !== 'funded') {
            return response()->json(['message' => 'Only funded proposals can have their funding revoked.'], 422);
        }

        try {
            DB::table('proposals')->where('id', $proposal->id)
                ->update(['rejection_reason' => $request->reason, 'rejected_at' => now()]);

            $updated = $this->workflowService->transition(
                $proposal->fresh(),
                'revoke_funding',
                $request->user(),
                $request->reason
            );

            return response()->json([
                'data' => ['status' => $updated->status],
                'message' => 'Funding revoked. Proposal has been moved to rejected.',
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

    /**
     * College RTT managers act only on their own college's proposals, and category
     * directors only on their own category's.
     */
    private function outOfScope(Request $request, Proposal $proposal): ?JsonResponse
    {
        $outside = ($request->_college_scope && $proposal->college_id !== $request->_college_scope)
            || ($request->_category_scope && $proposal->category !== $request->_category_scope);

        return $outside
            ? response()->json(['data' => null, 'message' => 'This proposal is outside your college or category.', 'errors' => [], 'meta' => []], 403)
            : null;
    }
}
