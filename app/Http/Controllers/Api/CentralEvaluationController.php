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

        if ($request->_college_scope) {
            $query->where('college_id', $request->_college_scope);
        }

        $proposals = $query->get()
            ->map(function (Proposal $p) {
                $blind   = $p->reviewAssignments->filter(fn ($a) => str_starts_with($a->evaluation_type?->name ?? '', 'blind_review'));
                $defence = $p->reviewAssignments->filter(fn ($a) => str_starts_with($a->evaluation_type?->name ?? '', 'open_defence'));

                $blindScore   = $blind->isNotEmpty()
                    ? round($blind->map(fn ($a) => $this->scoreService->calculateScore($a))->avg(), 2)
                    : null;
                $defenceScore = $defence->isNotEmpty()
                    ? round($defence->map(fn ($a) => $this->scoreService->calculateScore($a))->avg(), 2)
                    : null;
                $combined     = ($blindScore ?? 0) + ($defenceScore ?? 0);
                $threshold    = (float) (DB::table('threshold_settings')->where('key', 'combined_threshold')->value('value') ?? 120);
                $budgetTotal  = $p->budgets->sum('amount');

                // Raw weighted scores for display (X / totalWeight)
                $blindDisplayInfos   = $blind->map(fn ($a) => $this->scoreService->calculateWeightedDisplay($a));
                $defenceDisplayInfos = $defence->map(fn ($a) => $this->scoreService->calculateWeightedDisplay($a));

                $blindScoreRaw   = $blindDisplayInfos->isNotEmpty()
                    ? round($blindDisplayInfos->avg('score'), 2) : null;
                $blindMax        = $blindDisplayInfos->isNotEmpty()
                    ? $blindDisplayInfos->first()['max'] : null;
                $defenceScoreRaw = $defenceDisplayInfos->isNotEmpty()
                    ? round($defenceDisplayInfos->avg('score'), 2) : null;
                $defenceMax      = $defenceDisplayInfos->isNotEmpty()
                    ? $defenceDisplayInfos->first()['max'] : null;

                return array_merge($p->toArray(), [
                    'blind_score'       => $blindScore,
                    'defence_score'     => $defenceScore,
                    'blind_score_raw'   => $blindScoreRaw,
                    'blind_max'         => $blindMax,
                    'defence_score_raw' => $defenceScoreRaw,
                    'defence_max'       => $defenceMax,
                    'combined_score'    => round($combined, 2),
                    'threshold'         => $threshold,
                    'budget_total'   => $budgetTotal,
                ]);
            });

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function centralApprove(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'awarded_amount' => 'required|numeric|min:1',
            'remarks'        => 'nullable|string',
        ]);

        $proposal = Proposal::findOrFail($id);

        try {
            $updated = $this->workflowService->transition(
                $proposal,
                'central_approve',
                $request->user(),
                $request->remarks ?? 'Approved by Central Office for funding'
            );

            if (! Award::where('proposal_id', $updated->id)->exists()) {
                $award = $this->awardService->createForFundedProposal(
                    $updated,
                    $request->user(),
                    (float) $request->awarded_amount,
                    $request->remarks
                );
            } else {
                $award = Award::where('proposal_id', $updated->id)->first();
                $award->update(['awarded_amount' => (float) $request->awarded_amount]);
                if ($request->remarks) {
                    $award->update(['approval_notes' => $request->remarks]);
                }
            }

            return response()->json([
                'data'    => ['status' => $updated->status, 'grant_reference' => $award->grant_reference],
                'message' => 'Proposal approved for funding. Grant: '.$award->grant_reference,
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
                'data'    => ['status' => $updated->status],
                'message' => 'Proposal rejected.',
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
}
