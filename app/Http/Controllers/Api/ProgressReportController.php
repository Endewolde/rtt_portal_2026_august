<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetMilestone;
use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Services\ProgressReportService;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProgressReportController extends Controller
{
    public function __construct(private ProgressReportService $reports) {}

    /** The project's reporting schedule (team members and its reviewers). */
    public function index(string $proposalId, Request $request): JsonResponse
    {
        $proposal = Proposal::findOrFail($proposalId);
        $user = $request->user();
        $isTeam = $this->reports->isTeamMember($proposal, $user);
        $canReview = $this->reports->canReview($proposal, $user);

        if (! $isTeam && ! $canReview) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        $reports = in_array($proposal->status, ProgressReportService::REPORTING_STATUSES, true)
            ? $this->reports->syncSchedule($proposal)
            : ProgressReport::where('proposal_id', $proposal->id)->orderBy('period_number')->get();

        $reports->load(['submittedBy:id,name', 'reviewedBy:id,name']);

        return response()->json([
            'data' => $reports->map(fn (ProgressReport $r) => $r->toArray() + [
                'is_overdue' => $r->isOverdue(),
                'has_attachment' => (bool) $r->attachment_path,
            ])->values(),
            'message' => '',
            'errors' => [],
            'meta' => [
                'can_submit' => $isTeam,
                'can_review' => $canReview,
                'milestones' => BudgetMilestone::where('proposal_id', $proposal->id)->orderBy('sort_order')->get(['id', 'title', 'status', 'due_date']),
            ],
        ]);
    }

    public function submit(string $id, Request $request): JsonResponse
    {
        $data = $request->validate([
            'summary' => 'required|string|min:30|max:5000',
            'achievements' => 'nullable|string|max:5000',
            'challenges' => 'nullable|string|max:5000',
            'next_steps' => 'nullable|string|max:5000',
            'percent_complete' => 'required|integer|min:0|max:100',
            'budget_spent' => 'nullable|numeric|min:0',
            'milestone_updates' => 'nullable|array',
            'milestone_updates.*.milestone_id' => 'required_with:milestone_updates|uuid',
            'milestone_updates.*.status' => 'required_with:milestone_updates|in:pending,in_progress,completed',
            'milestone_updates.*.note' => 'nullable|string|max:500',
            'attachment' => 'nullable|file|mimes:pdf,doc,docx|max:10240',
        ]);

        $report = ProgressReport::with('proposal')->findOrFail($id);

        try {
            $report = $this->reports->submit($report, $request->user(), $data, $request->file('attachment'));
        } catch (\RuntimeException $e) {
            return $this->respond(null, $e->getMessage(), 422);
        }

        return $this->respond($report, ($report->is_final ? 'Final report' : 'Progress report').' submitted. Your college officer and director have been notified.');
    }

    public function review(string $id, Request $request): JsonResponse
    {
        $data = $request->validate([
            'decision' => 'required|in:accepted,revision_requested',
            'notes' => 'required_if:decision,revision_requested|nullable|string|min:5|max:2000',
        ]);

        $report = ProgressReport::with('proposal')->findOrFail($id);

        if (! $this->reports->canReview($report->proposal, $request->user())) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        try {
            $report = $this->reports->review($report, $request->user(), $data['decision'], $data['notes'] ?? '');
        } catch (\RuntimeException $e) {
            return $this->respond(null, $e->getMessage(), 422);
        }

        return $this->respond($report, $data['decision'] === 'accepted' ? 'Report accepted.' : 'Sent back to the PI for revision.');
    }

    public function attachment(string $id, Request $request): StreamedResponse|JsonResponse
    {
        $report = ProgressReport::with('proposal')->findOrFail($id);
        $user = $request->user();

        if (! $this->reports->isTeamMember($report->proposal, $user) && ! $this->reports->canReview($report->proposal, $user)) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        /** @var Filesystem $disk */
        $disk = Storage::disk('private');
        if (! $report->attachment_path || ! $disk->exists($report->attachment_path)) {
            return $this->respond(null, 'No attachment found.', 404);
        }

        return $disk->download($report->attachment_path, $report->attachment_name ?? 'progress-report');
    }

    /** Monitoring overview: due soon, overdue and awaiting review, scoped by college / category. */
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('progress_reports.review')) {
            return $this->respond(null, 'Unauthorized.', 403);
        }

        $reports = ProgressReport::with(['proposal:id,tracker_number,title,category,college_id,pi_user_id,status', 'proposal.college:id,name', 'proposal.pi:id,name'])
            ->whereHas('proposal', fn ($q) => $q
                ->when($request->_college_scope, fn ($q, $c) => $q->where('college_id', $c))
                ->when($request->_category_scope, fn ($q, $c) => $q->where('category', $c)))
            ->orderBy('due_date')
            ->get();

        $rows = $reports->map(fn (ProgressReport $r) => [
            'id' => $r->id,
            'proposal' => $r->proposal,
            'period_number' => $r->period_number,
            'is_final' => $r->is_final,
            'period_start' => $r->period_start->toDateString(),
            'period_end' => $r->period_end->toDateString(),
            'due_date' => $r->due_date->toDateString(),
            'status' => $r->status,
            'is_overdue' => $r->isOverdue(),
            'percent_complete' => $r->percent_complete,
            'submitted_at' => $r->submitted_at?->toIso8601String(),
        ]);

        $groups = [
            'awaiting_review' => $rows->where('status', ProgressReport::STATUS_SUBMITTED)->values(),
            'overdue' => $rows->where('is_overdue', true)->values(),
            'due_soon' => $rows->filter(fn ($r) => ! $r['is_overdue']
                && in_array($r['status'], [ProgressReport::STATUS_DUE, ProgressReport::STATUS_REVISION], true)
                && $r['period_end'] <= now()->toDateString())->values(),
        ];

        return $this->respond($groups);
    }

    private function respond(mixed $data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }
}
