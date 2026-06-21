<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Award;
use App\Models\Proposal;
use App\Services\AwardService;
use App\Services\ReviewScoreService;
use App\Services\WorkflowService;
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
                'reviewAssignments.evaluationType:id,name',
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
                $blind = $p->reviewAssignments->filter(fn ($a) => str_starts_with($a->evaluationType?->name ?? '', 'blind_review'));
                $defence = $p->reviewAssignments->filter(fn ($a) => str_starts_with($a->evaluationType?->name ?? '', 'open_defence'));

                // Normalized percentage scores per type (0–100%), used for display
                $blindScore = $blind->isNotEmpty()
                    ? round($blind->map(fn ($a) => $this->scoreService->calculateScore($a))->avg(), 2)
                    : null;
                $defenceScore = $defence->isNotEmpty()
                    ? round($defence->map(fn ($a) => $this->scoreService->calculateScore($a))->avg(), 2)
                    : null;

                // Raw weighted scores: each out of its evaluation type's total weight
                // (e.g. blind review out of 80, open defence out of 20)
                $blindDisplayInfos = $blind->map(fn ($a) => $this->scoreService->calculateWeightedDisplay($a));
                $defenceDisplayInfos = $defence->map(fn ($a) => $this->scoreService->calculateWeightedDisplay($a));

                $blindScoreRaw = $blindDisplayInfos->isNotEmpty()
                    ? round($blindDisplayInfos->avg('score'), 2) : null;
                $blindMax = $blindDisplayInfos->isNotEmpty()
                    ? $blindDisplayInfos->first()['max'] : null;
                $defenceScoreRaw = $defenceDisplayInfos->isNotEmpty()
                    ? round($defenceDisplayInfos->avg('score'), 2) : null;
                $defenceMax = $defenceDisplayInfos->isNotEmpty()
                    ? $defenceDisplayInfos->first()['max'] : null;

                // Total weight from DB category weights (e.g. blind=80 + defence=20 = 100)
                $totalMax = ($blindMax ?? 0) + ($defenceMax ?? 0);

                // Combined uses raw weighted scores out of totalMax
                $combined = ($blindScoreRaw ?? 0) + ($defenceScoreRaw ?? 0);

                // Threshold is a percentage of totalMax (e.g. 70% of 100 = 70 minimum score)
                $thresholdPct = (float) (DB::table('threshold_settings')->where('key', 'combined_threshold')->value('value') ?? 70);
                $threshold = $totalMax > 0 ? round($thresholdPct / 100 * $totalMax, 2) : $thresholdPct;

                $budgetTotal = $p->budgets->sum('amount');

                return array_merge($p->toArray(), [
                    'blind_score' => $blindScore,
                    'defence_score' => $defenceScore,
                    'blind_score_raw' => $blindScoreRaw,
                    'blind_max' => $blindMax,
                    'defence_score_raw' => $defenceScoreRaw,
                    'defence_max' => $defenceMax,
                    'combined_score' => round($combined, 2),
                    'total_max' => $totalMax,
                    'threshold_pct' => $thresholdPct,
                    'threshold' => $threshold,
                    'budget_total' => $budgetTotal,
                ]);
            });

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function centralApprove(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'awarded_amount' => 'required|numeric|min:1',
            'remarks' => 'nullable|string',
        ]);

        $proposal = Proposal::findOrFail($id);

        try {
            // Create or update the award BEFORE transitioning so that when the
            // ProposalTransitioned event fires and sends the email, the correct
            // awarded_amount is already persisted on the award record.
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

    /** Revoke funding for a funded proposal and move it back to rejected. */
    public function revokeFunding(Request $request, string $id): JsonResponse
    {
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
