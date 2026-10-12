<?php

namespace App\Services;

use App\Models\Proposal;
use App\Models\ProposalApprovalReport;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Putting a proposal back where a mistaken-approval report pulled it from — shared by
 * withdrawing a report, resolving it as "approval stands", and the one-off repair
 * of reports resolved before "approval stands" restored anything.
 */
class ApprovalReportService
{
    /** Workflow action that returns a proposal from validated to the stage the report pulled it from. */
    public const RESTORE_ACTIONS = [
        'under_blind_review' => 'withdraw_report_resume_review',
        'blind_review_passed' => 'withdraw_report_restore_passed',
    ];

    public function __construct(
        private readonly WorkflowService $workflowService,
        private readonly ReviewScoreService $reviewScoreService,
    ) {}

    /**
     * Restore the proposal and, if it lands back in blind review with every score
     * already in, make the normal automatic decision. Returns the stage it was
     * restored to, or null when the report never moved it.
     */
    public function restoreProposal(ProposalApprovalReport $report, Proposal $proposal, User $actor, string $note): ?string
    {
        $restoreTo = $this->stageReturnedFrom($report);
        $restoreAction = self::RESTORE_ACTIONS[$restoreTo] ?? null;

        if (! $restoreAction) {
            return null;
        }

        $this->workflowService->transition($proposal, $restoreAction, $actor, $note);

        return $restoreTo;
    }

    /** Run the automatic blind-review decision if the restored proposal's reviews are all in. */
    public function continueFrom(Proposal $proposal, ?string $restoredTo): void
    {
        if ($restoredTo === 'under_blind_review') {
            $this->reviewScoreService->processBlindReviewResult($proposal->fresh());
        }
    }

    /** The stage this report pulled the proposal back from (null if it was already validated). */
    public function stageReturnedFrom(ProposalApprovalReport $report): ?string
    {
        if ($report->returned_from_status) {
            return $report->returned_from_status;
        }

        // Reports filed before returned_from_status was recorded.
        return DB::table('workflow_logs')
            ->where('proposal_id', $report->proposal_id)
            ->where('action', 'return_for_investigation')
            ->where('created_at', '>=', $report->created_at->copy()->subMinute())
            ->orderBy('created_at')
            ->value('from_stage');
    }

    /**
     * Reports already resolved with the approval standing whose proposal was never
     * put back — still at validated after the report pulled it out of blind review.
     *
     * A case is safe to restore only if nothing has happened to the proposal since
     * the report's pull-back (no later workflow step); otherwise someone has acted on
     * it and it is left for a person to decide.
     *
     * @return Collection<int, array{report: ProposalApprovalReport, proposal: Proposal, restore_to: string, safe: bool, reason: string}>
     */
    public function stuckApprovalStands(): Collection
    {
        return ProposalApprovalReport::with(['proposal', 'reportedBy:id,name', 'reviewedBy:id,name'])
            ->where('status', 'reviewed')
            ->where(fn ($q) => $q->whereNull('outcome')->orWhere('outcome', 'approval_stands'))
            ->whereHas('proposal', fn ($q) => $q->where('status', 'validated'))
            ->orderBy('created_at')
            ->get()
            ->map(function (ProposalApprovalReport $report) {
                $restoreTo = $this->stageReturnedFrom($report);
                if (! isset(self::RESTORE_ACTIONS[$restoreTo])) {
                    return null;
                }

                $pullBack = DB::table('workflow_logs')
                    ->where('proposal_id', $report->proposal_id)
                    ->where('action', 'return_for_investigation')
                    ->where('created_at', '>=', $report->created_at->copy()->subMinute())
                    ->orderBy('created_at')
                    ->first();

                $laterSteps = $pullBack
                    ? DB::table('workflow_logs')
                        ->where('proposal_id', $report->proposal_id)
                        ->where('created_at', '>', $pullBack->created_at)
                        ->orderBy('created_at')
                        ->pluck('action')
                    : collect();

                return [
                    'report' => $report,
                    'proposal' => $report->proposal,
                    'restore_to' => $restoreTo,
                    'safe' => $laterSteps->isEmpty(),
                    'reason' => $laterSteps->isEmpty()
                        ? 'nothing has happened to the proposal since the report — safe to restore'
                        : 'workflow activity since the report ('.$laterSteps->implode(', ').') — needs a person to decide',
                ];
            })
            ->filter()
            ->values();
    }
}
