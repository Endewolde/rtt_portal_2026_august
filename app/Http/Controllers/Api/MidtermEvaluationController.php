<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Services\MidtermEvaluationService;
use App\Support\AuditLogger;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MidtermEvaluationController extends Controller
{
    public function __construct(private MidtermEvaluationService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = MidtermEvaluation::with([
            'proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'proposal.college:id,name',
            'proposal.pi:id,name,email',
            'scheduledBy:id,name',
            'scoredBy:id,name',
        ])->orderByDesc('evaluation_date');

        if ($user->hasRole('college_officer') ||
            ($user->hasRole('support_officer') && $user->college_id)) {
            $query->whereHas('proposal', fn ($q) => $q->where('college_id', $user->college_id));
        } elseif ($user->hasRole('research_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'research'));
        } elseif ($user->hasRole('community_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'community_engagement'));
        } elseif ($user->hasRole('technology_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'technology_transfer'));
        } elseif (! $user->hasAnyRole(['super_admin', 'central_officer', 'support_officer'])) {
            $query->whereHas('proposal', fn ($q) => $q->where('pi_user_id', $user->id)
                ->orWhereHas('members', fn ($sq) => $sq->where('user_id', $user->id)->where('status', 'active')
                )
            );
        }

        return response()->json([
            'data' => $query->get(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $evaluation = MidtermEvaluation::with([
            'proposal:id,tracker_number,title,pi_user_id,college_id,category',
            'proposal.college:id,name',
            'proposal.pi:id,name,email',
            'scheduledBy:id,name',
            'scoredBy:id,name',
        ])->findOrFail($id);

        return response()->json(['data' => $evaluation, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /**
     * Proposals eligible for midterm evaluation scheduling:
     * funded status + PI has submitted a Round 1 settlement (any stage ≥ submitted).
     * College verifies the settlement AFTER scoring the M&E — not before — so we only
     * require the settlement to exist, not to be finance_verified (which would create a deadlock).
     * Scoped to the officer's college for college_officer / college_admin roles.
     */
    public function eligibleProposals(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Proposal::where('status', 'funded')
            ->whereExists(fn ($q) => $q->from('budget_settlements')
                ->join('budget_requests', 'budget_settlements.budget_request_id', '=', 'budget_requests.id')
                ->whereColumn('budget_requests.proposal_id', 'proposals.id')
                ->whereIn('budget_settlements.status', ['submitted', 'college_verified', 'finance_verified'])
            )
            ->with(['pi:id,name,email', 'college:id,name'])
            ->orderBy('tracker_number');

        if ($user->hasRole('college_officer')) {
            $query->where('college_id', $user->college_id);
        } elseif ($user->hasRole('research_officer')) {
            $query->where('category', 'research');
        } elseif ($user->hasRole('community_officer')) {
            $query->where('category', 'community_engagement');
        } elseif ($user->hasRole('technology_officer')) {
            $query->where('category', 'technology_transfer');
        }

        return response()->json([
            'data' => $query->get(['id', 'tracker_number', 'title', 'pi_user_id', 'college_id', 'category']),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function schedule(Request $request): JsonResponse
    {
        $request->validate([
            'proposal_id' => 'required|uuid|exists:proposals,id',
            'evaluation_date' => 'required|date|after_or_equal:today',
            'evaluation_time' => 'nullable|date_format:H:i',
            'venue' => 'nullable|string|max:300',
        ]);

        $proposal = Proposal::findOrFail($request->proposal_id);

        try {
            $evaluation = $this->service->schedule(
                $proposal,
                Carbon::parse($request->evaluation_date),
                $request->user(),
                $request->input('evaluation_time'),
                $request->input('venue')
            );

            AuditLogger::log(
                'evaluation.midterm_scheduled',
                Proposal::class,
                $proposal->id,
                $request->user()->id,
                null,
                ['evaluation_date' => $request->evaluation_date, 'venue' => $request->venue, 'tracker' => $proposal->tracker_number],
            );

            return response()->json([
                'data' => $evaluation->load(['proposal:id,tracker_number,title', 'scheduledBy:id,name']),
                'message' => 'Midterm evaluation scheduled.',
                'errors' => [],
                'meta' => [],
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    /**
     * Schedule midterm evaluations for every eligible proposal in the officer's college.
     */
    public function bulkSchedule(Request $request): JsonResponse
    {
        $request->validate([
            'evaluation_date' => 'required|date|after_or_equal:today',
            'evaluation_time' => 'nullable|date_format:H:i',
            'venue' => 'nullable|string|max:300',
        ]);

        $user = $request->user();
        $date = Carbon::parse($request->evaluation_date);
        $time = $request->input('evaluation_time');
        $venue = $request->input('venue');

        $query = Proposal::where('status', 'funded')
            ->whereExists(fn ($q) => $q->from('budget_settlements')
                ->join('budget_requests', 'budget_settlements.budget_request_id', '=', 'budget_requests.id')
                ->whereColumn('budget_requests.proposal_id', 'proposals.id')
                ->whereIn('budget_settlements.status', ['submitted', 'college_verified', 'finance_verified'])
            );

        if ($user->hasRole('college_officer')) {
            $query->where('college_id', $user->college_id);
        }

        $proposals = $query->get();
        $scheduled = 0;
        $skipped = 0;

        foreach ($proposals as $proposal) {
            try {
                $this->service->schedule($proposal, $date, $user, $time, $venue);
                $scheduled++;
            } catch (\Exception) {
                $skipped++;
            }
        }

        return response()->json([
            'data' => ['scheduled' => $scheduled, 'skipped' => $skipped],
            'message' => "{$scheduled} evaluation(s) scheduled for your college.",
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function submitReport(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'progress_summary' => 'required|string',
            'financial_utilization_percentage' => 'nullable|numeric|min:0|max:100',
            'publications_count' => 'nullable|integer|min:0',
            'challenges' => 'nullable|string',
            'milestones_achieved' => 'nullable|string',
            'milestones_missed' => 'nullable|string',
        ]);

        $evaluation = MidtermEvaluation::with('proposal')->findOrFail($id);

        try {
            $updated = $this->service->submitReport($evaluation, $request->user(), $request->all());

            return response()->json(['data' => $updated, 'message' => 'Report submitted.', 'errors' => [], 'meta' => []]);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    public function score(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'progress_score' => 'required|numeric|min:0|max:100',
            'recommendation' => 'required|in:continue,hold',
            'comments' => 'nullable|string',
        ]);

        $evaluation = MidtermEvaluation::with('proposal.college')->findOrFail($id);

        try {
            $updated = $this->service->score($evaluation, $request->user(), [
                'progress_score' => $request->progress_score,
                'recommendation' => $request->recommendation,
                'comments' => $request->input('comments', ''),
            ]);

            AuditLogger::log(
                'evaluation.midterm_scored',
                MidtermEvaluation::class,
                $evaluation->id,
                $request->user()->id,
                null,
                ['score' => $request->progress_score, 'recommendation' => $request->recommendation, 'tracker' => $evaluation->proposal?->tracker_number],
            );

            return response()->json([
                'data' => $updated,
                'message' => 'Evaluation scored. Recommendation: '.ucfirst($request->recommendation).'.',
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }
    }

    public function uploadReport(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:20480',
            'type' => 'required|in:progress,financial',
        ]);

        $evaluation = MidtermEvaluation::findOrFail($id);
        $path = $request->file('file')->store("midterm/{$id}/{$request->type}", 'private');
        $field = $request->type === 'financial' ? 'financial_report_path' : 'progress_report_path';
        $evaluation->update([$field => $path]);

        return response()->json([
            'data' => ['path' => $path, 'filename' => $request->file('file')->getClientOriginalName()],
            'message' => ucfirst($request->type).' report uploaded.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function downloadReport(string $id, string $type)
    {
        $evaluation = MidtermEvaluation::findOrFail($id);

        $path = match ($type) {
            'progress' => $evaluation->progress_report_path,
            'financial' => $evaluation->financial_report_path,
            default => null,
        };

        if (! $path) {
            abort(404, 'No report of this type has been uploaded.');
        }

        if (! \Storage::disk('private')->exists($path)) {
            abort(404, 'Report file not found.');
        }

        $filename = "midterm-{$type}-report-{$id}.pdf";

        return \Storage::disk('private')->download($path, $filename);
    }

    public function stats(): JsonResponse
    {
        return response()->json([
            'data' => [
                'total' => MidtermEvaluation::count(),
                'scheduled' => MidtermEvaluation::where('status', 'scheduled')->count(),
                'report_submitted' => MidtermEvaluation::where('status', 'report_submitted')->count(),
                'scored' => MidtermEvaluation::where('status', 'scored')->count(),
                'continue' => MidtermEvaluation::where('recommendation', 'continue')->count(),
                'hold' => MidtermEvaluation::where('recommendation', 'hold')->count(),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
