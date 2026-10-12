<?php

namespace App\Services;

use App\Jobs\ArchiveProposalJob;
use App\Models\BudgetSettlement;
use App\Models\CompletionWorkshop;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\ProposalClosureChecklist;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Models\User;

class CompletionWorkshopService
{
    public function __construct(
        private WorkflowService $workflowService,
        private NotificationService $notificationService,
        private FeatureService $featureService
    ) {}

    /**
     * Schedule a completion workshop.
     *
     * @param  array  $data  date, time, venue, online_link
     */
    public function schedule(Proposal $proposal, array $data, User $scheduledBy): CompletionWorkshop
    {
        // Midterm must be scored/completed with a "continue" recommendation
        $passedMidterm = MidtermEvaluation::where('proposal_id', $proposal->id)
            ->where('recommendation', 'continue')
            ->whereIn('status', ['scored', 'completed'])
            ->exists();

        if (! $passedMidterm) {
            throw new \Exception(
                'A completion workshop can only be scheduled after the Mid-Term M&E has been scored with a "Continue" recommendation.'
            );
        }

        // Final financial settlement (round 2+) must be finance_verified
        $finalSettlementVerified = BudgetSettlement::whereHas('budgetRequest', fn ($q) => $q->where('proposal_id', $proposal->id)->where('funding_round', '>=', 2)
        )->where('status', 'finance_verified')->exists();

        if (! $finalSettlementVerified) {
            throw new \Exception(
                'The final financial settlement (Phase II budget) must be verified by Finance before scheduling the completion workshop.'
            );
        }

        $workshop = CompletionWorkshop::create([
            'proposal_id' => $proposal->id,
            'scheduled_date' => $data['date'],
            'scheduled_time' => $data['time'],
            'venue' => $data['venue'],
            'online_link' => $data['online_link'] ?? null,
            'status' => 'scheduled',
            'scheduled_by' => $scheduledBy->id,
        ]);

        $pi = User::find($proposal->pi_user_id);
        if ($pi) {
            $this->notificationService->send('workshop_scheduled', $pi, [
                'tracker_number' => $proposal->tracker_number,
                'date' => $data['date'],
                'venue' => $data['venue'],
            ]);
        }

        return $workshop->fresh();
    }

    /**
     * Store evidence and remarks for a workshop.
     *
     * @param  array  $files  presentation_files, photos, videos, final_report_path
     */
    public function storeEvidence(
        CompletionWorkshop $workshop,
        array $files,
        string $remarks
    ): CompletionWorkshop {
        $workshop->update([
            'evaluator_remarks' => $remarks,
            'presentation_files' => $files['presentation_files'] ?? [],
            'photos' => $files['photos'] ?? [],
            'videos' => $files['videos'] ?? [],
            'final_report_path' => $files['final_report_path'] ?? null,
        ]);

        return $workshop->fresh();
    }

    /**
     * Finalize workshop, transition to completed, queue archival with 30-day delay.
     */
    public function finalizeWorkshop(
        CompletionWorkshop $workshop,
        float $finalScore,
        User $approvedBy
    ): Proposal {
        // No actor-based bypass here — this is a governance gate on the workflow
        // itself, not a UI visibility check, so it applies uniformly once enabled.
        if ($this->featureService->hasSubFeature('workflow.closure_checklist')) {
            $checklist = ProposalClosureChecklist::where('proposal_id', $workshop->proposal_id)->first();

            if (! $checklist?->isComplete()) {
                throw new \Exception(
                    'The project closure checklist must be fully confirmed before this workshop can be finalized.'
                );
            }
        }

        $workshop->update([
            'final_score' => $finalScore,
            'status' => 'completed',
        ]);

        $proposal = $workshop->proposal;

        $completedProposal = $this->workflowService->transition(
            $proposal,
            'complete',
            $approvedBy,
            "Completion workshop finalized. Score: {$finalScore}"
        );

        $this->createOrUpdateRepositoryRecord($completedProposal);

        ArchiveProposalJob::dispatch($completedProposal->id)
            ->delay(now()->addDays(30));

        $pi = User::find($completedProposal->pi_user_id);
        if ($pi) {
            $this->notificationService->send('proposal_completed', $pi, [
                'tracker_number' => $completedProposal->tracker_number,
                'final_score' => $finalScore,
            ]);
        }

        return $completedProposal;
    }

    private function createOrUpdateRepositoryRecord(Proposal $proposal): void
    {
        $pi = User::find($proposal->pi_user_id);

        $outputCount = ResearchOutput::where('proposal_id', $proposal->id)->count();
        $pubCount = ResearchOutput::where('proposal_id', $proposal->id)->where('output_type', 'journal_article')->count();
        $patentCount = ResearchOutput::where('proposal_id', $proposal->id)->where('output_type', 'patent')->count();

        RepositoryRecord::updateOrCreate(
            ['proposal_id' => $proposal->id],
            [
                'title' => $proposal->title,
                'abstract' => $proposal->abstract,
                'keywords' => $proposal->keywords,
                'category' => $proposal->category,
                'college_id' => $proposal->college_id,
                'pi_name' => $pi?->name ?? '',
                'academic_year' => $proposal->academic_year,
                'status' => 'published',
                'total_outputs' => $outputCount,
                'publications_count' => $pubCount,
                'patents_count' => $patentCount,
            ]
        );
    }
}
