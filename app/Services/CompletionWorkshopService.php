<?php

namespace App\Services;

use App\Jobs\ArchiveProposalJob;
use App\Models\CompletionWorkshop;
use App\Models\Proposal;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CompletionWorkshopService
{
    public function __construct(
        private WorkflowService $workflowService,
        private NotificationService $notificationService
    ) {}

    /**
     * Schedule a completion workshop.
     *
     * @param  array  $data  date, time, venue, online_link
     */
    public function schedule(Proposal $proposal, array $data, User $scheduledBy): CompletionWorkshop
    {
        $workshop = CompletionWorkshop::create([
            'proposal_id'    => $proposal->id,
            'scheduled_date' => $data['date'],
            'scheduled_time' => $data['time'],
            'venue'          => $data['venue'],
            'online_link'    => $data['online_link'] ?? null,
            'status'         => 'scheduled',
            'scheduled_by'   => $scheduledBy->id,
        ]);

        $pi = User::find($proposal->pi_user_id);
        if ($pi) {
            $this->notificationService->send('workshop_scheduled', $pi, [
                'tracker_number' => $proposal->tracker_number,
                'date'           => $data['date'],
                'venue'          => $data['venue'],
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
            'evaluator_remarks'  => $remarks,
            'presentation_files' => $files['presentation_files'] ?? [],
            'photos'             => $files['photos'] ?? [],
            'videos'             => $files['videos'] ?? [],
            'final_report_path'  => $files['final_report_path'] ?? null,
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
        $workshop->update([
            'final_score' => $finalScore,
            'status'      => 'completed',
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
                'final_score'    => $finalScore,
            ]);
        }

        return $completedProposal;
    }

    private function createOrUpdateRepositoryRecord(Proposal $proposal): void
    {
        $pi = User::find($proposal->pi_user_id);

        $outputCount = ResearchOutput::where('proposal_id', $proposal->id)->count();
        $pubCount    = ResearchOutput::where('proposal_id', $proposal->id)->where('output_type', 'journal_article')->count();
        $patentCount = ResearchOutput::where('proposal_id', $proposal->id)->where('output_type', 'patent')->count();

        RepositoryRecord::updateOrCreate(
            ['proposal_id' => $proposal->id],
            [
                'title'              => $proposal->title,
                'abstract'           => $proposal->abstract,
                'keywords'           => $proposal->keywords,
                'category'           => $proposal->category,
                'college_id'         => $proposal->college_id,
                'pi_name'            => $pi?->name ?? '',
                'academic_year'      => $proposal->academic_year,
                'status'             => 'published',
                'total_outputs'      => $outputCount,
                'publications_count' => $pubCount,
                'patents_count'      => $patentCount,
            ]
        );
    }
}
