<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Award;
use App\Models\Proposal;
use App\Models\User;
use App\Services\AwardService;
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
        private AwardService $awardService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('awards.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $query = Proposal::where('status', 'accepted')
            ->with([
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

        $proposals = $query->get()
            ->map(function (Proposal $p) {
                // Live recalculation against CURRENT threshold settings and CURRENT
                // evaluation-criteria weights — never cached, so this list is always
                // up to date even if thresholds/criteria changed after the proposal's
                // automatic blind/defence decision.
                $snapshot = $this->scoreService->recalculateSnapshot($p);

                $budgetTotal = $p->budgets->sum('amount');

                return array_merge($p->toArray(), [
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
                ]);
            });

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function centralApprove(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'awarded_amount' => 'required|numeric|min:1',
            'remarks' => 'nullable|string|max:2000',
        ]);

        $proposal = Proposal::findOrFail($id);

        try {
            // Create or update the award BEFORE transitioning so that when the
            // ProposalTransitioned event fires and sends the email, the correct
            // awarded_amount is already persisted on the award record. One
            // transaction: a refused transition must not leave an award behind.
            [$updated, $award] = DB::transaction(function () use ($request, $proposal) {
                $existingAward = Award::where('proposal_id', $proposal->id)->first();
                if ($existingAward) {
                    $existingAward->update([
                        'awarded_amount' => (float) $request->awarded_amount,
                        'approval_notes' => $request->remarks ?? $existingAward->approval_notes,
                        'approved_by' => $request->user()->id,
                        'approved_at' => now(),
                    ]);
                    $award = $existingAward->fresh();
                } else {
                    $award = $this->awardService->createForFundedProposal(
                        $proposal,
                        $request->user(),
                        (float) $request->awarded_amount,
                        $request->remarks
                    );
                }

                $updated = $this->workflowService->transition(
                    $proposal,
                    'central_approve',
                    $request->user(),
                    $request->remarks ?? 'Approved by Central Office for funding'
                );

                return [$updated, $award];
            });

            return response()->json([
                'data' => ['status' => $updated->status, 'grant_reference' => $award->grant_reference],
                'message' => 'Proposal approved for funding. Grant: '.$award->grant_reference,
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

    public function centralReject(Request $request, string $id): JsonResponse
    {
        RejectionReasons::apply($request, 'central_evaluation');
        $request->validate(['reason' => 'required|string|min:10']);

        $proposal = Proposal::findOrFail($id);

        try {
            DB::table('proposals')->where('id', $proposal->id)
                ->update(['rejection_reason' => $request->reason, 'rejected_at' => now()]);

            $updated = $this->workflowService->transition(
                $proposal->fresh(),
                'central_reject',
                $request->user(),
                $request->reason
            );

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

        $activeFunded = $asPi->where('status', 'funded')->values();
        $historicalFunded = $asPi->where('status', 'funded')->values(); // same for now; extend if you add 'completed'

        // Proposals where this user is a co-investigator (any active/funded)
        $asCoInv = Proposal::whereHas('members', fn ($q) => $q->where('user_id', $userId)->where('role', 'co_investigator'))
            ->where('status', 'funded')
            ->with(['college:id,name'])
            ->get(['id', 'tracker_number', 'title', 'status', 'category', 'college_id']);

        $totalAwarded = $asPi->whereNotNull('award')->sum(fn ($p) => (float) ($p->award?->awarded_amount ?? 0));
        $fundedCount = $asPi->where('status', 'funded')->count();

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

        if (! $request->user()?->hasAnyRole(['super_admin', 'central_officer'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $proposal = Proposal::findOrFail($id);

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
}
