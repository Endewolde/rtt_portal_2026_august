<?php

namespace App\Services;

use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\User;
use Carbon\Carbon;

class MidtermEvaluationService
{
    public function __construct(
        private WorkflowService $workflowService,
        private NotificationService $notificationService
    ) {}

    /**
     * Schedule a midterm evaluation for a funded proposal.
     *
     * @throws \Exception
     */
    public function schedule(
        Proposal $proposal,
        Carbon $evaluationDate,
        User $scheduledBy,
        ?string $evaluationTime = null,
        ?string $venue = null
    ): MidtermEvaluation {
        if ($proposal->status !== 'funded') {
            throw new \Exception(
                "Proposal must be funded for midterm evaluation. Current: {$proposal->status}"
            );
        }

        $evaluation = MidtermEvaluation::create([
            'proposal_id' => $proposal->id,
            'evaluation_date' => $evaluationDate->toDateString(),
            'evaluation_time' => $evaluationTime,
            'venue' => $venue,
            'status' => 'scheduled',
            'scheduled_by' => $scheduledBy->id,
        ]);

        $this->workflowService->transition(
            $proposal,
            'start_midterm',
            $scheduledBy,
            "Midterm evaluation scheduled for {$evaluationDate->toDateString()}"
        );

        $pi = User::find($proposal->pi_user_id);
        if ($pi) {
            $this->notificationService->send('midterm_scheduled', $pi, [
                'proposal_id' => $proposal->id,
                'tracker_number' => $proposal->tracker_number,
                'evaluation_date' => $evaluationDate->toDateString(),
            ]);
        }

        return $evaluation->fresh();
    }

    /**
     * PI submits their midterm progress report.
     *
     * @throws \Exception if not in scheduled state
     */
    public function submitReport(
        MidtermEvaluation $evaluation,
        User $_pi,
        array $data
    ): MidtermEvaluation {
        if (! in_array($evaluation->status, ['scheduled', 'report_submitted'])) {
            throw new \Exception(
                'Report cannot be edited after the evaluation has been scored.'
            );
        }

        $alreadySubmitted = $evaluation->status === 'report_submitted';

        $evaluation->update([
            'status' => 'report_submitted',
            'progress_summary' => $data['progress_summary'],
            'financial_utilization_percentage' => $data['financial_utilization_percentage'] ?? null,
            'publications_count' => $data['publications_count'] ?? 0,
            'challenges' => $data['challenges'] ?? null,
            'milestones_achieved' => $data['milestones_achieved'] ?? null,
            'milestones_missed' => $data['milestones_missed'] ?? null,
            'progress_report_path' => $data['progress_report_path'] ?? null,
            'financial_report_path' => $data['financial_report_path'] ?? null,
        ]);

        if (! $alreadySubmitted) {
            $collegeOfficer = User::role('college_officer')
                ->where('college_id', $evaluation->proposal->college_id)
                ->first()
                ?? User::customRoleHolders('midterm_evaluations.create', $evaluation->proposal->college_id, $evaluation->proposal->category)->first();

            if ($collegeOfficer) {
                $this->notificationService->send('midterm_report_submitted', $collegeOfficer, [
                    'proposal_id' => $evaluation->proposal_id,
                    'tracker_number' => $evaluation->proposal->tracker_number,
                ]);
            }
        }

        return $evaluation->fresh();
    }

    /**
     * College Officer scores the midterm evaluation.
     *
     * @throws \Exception
     * @throws \InvalidArgumentException
     */
    public function score(
        MidtermEvaluation $evaluation,
        User $collegeOfficer,
        array $scoreData
    ): MidtermEvaluation {
        if (! in_array($evaluation->status, ['report_submitted', 'scored'])) {
            throw new \Exception(
                'Evaluation must have a submitted report before scoring.'
            );
        }

        if (! in_array($scoreData['recommendation'], ['continue', 'hold'])) {
            throw new \InvalidArgumentException("Recommendation must be 'continue' or 'hold'.");
        }

        $evaluation->update([
            'status' => 'scored',
            'progress_score' => $scoreData['progress_score'],
            'college_officer_comments' => $scoreData['comments'],
            'recommendation' => $scoreData['recommendation'],
            'scored_by' => $collegeOfficer->id,
            'scored_at' => now(),
        ]);

        if ($scoreData['recommendation'] === 'hold') {
            $pi = User::find($evaluation->proposal->pi_user_id);
            $centralOfficer = User::role('central_officer')->first();

            if ($pi) {
                $this->notificationService->send('midterm_hold', $pi, [
                    'tracker_number' => $evaluation->proposal->tracker_number,
                    'reason' => $scoreData['comments'],
                ]);
            }

            if ($centralOfficer) {
                $this->notificationService->send('midterm_hold', $centralOfficer, [
                    'tracker_number' => $evaluation->proposal->tracker_number,
                    'college' => $evaluation->proposal->college->name ?? '',
                ]);
            }
        }

        return $evaluation->fresh();
    }
}
