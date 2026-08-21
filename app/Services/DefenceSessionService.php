<?php

namespace App\Services;

use App\Models\DefenceSession;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DefenceSessionService
{
    public function __construct(
        private readonly WorkflowService $workflowService,
        private readonly ReviewScoreService $reviewScoreService,
        private readonly ReviewAssignmentService $reviewAssignmentService
    ) {}

    /**
     * Schedule an open defence session.
     *
     * @param  array  $data  date, time, venue, online_link, reviewer_ids, evaluation_type_id
     *
     * @throws \Exception if proposal not in blind_review_passed state
     */
    public function schedule(Proposal $proposal, array $data, User $scheduledBy): DefenceSession
    {
        if ($proposal->status !== 'blind_review_passed') {
            throw new \Exception(
                "Proposal must be in blind_review_passed state. Current: {$proposal->status}"
            );
        }

        $date = $data['scheduled_date'] ?? $data['date'] ?? null;
        $time = $data['scheduled_time'] ?? $data['time'] ?? null;

        if (! $date) {
            throw new \Exception('Defence date is required.');
        }

        return DB::transaction(function () use ($proposal, $data, $date, $time, $scheduledBy) {
            $session = DefenceSession::create([
                'proposal_id' => $proposal->id,
                'scheduled_date' => $date,
                'scheduled_time' => $time,
                'venue' => $data['venue'],
                'online_link' => $data['online_link'] ?? null,
                'status' => 'scheduled',
                'scheduled_by' => $scheduledBy->id,
            ]);

            if (! empty($data['reviewer_ids']) && ! empty($data['evaluation_type_id'])) {
                $this->reviewAssignmentService->assign(
                    $proposal,
                    $data['reviewer_ids'],
                    $data['evaluation_type_id'],
                    $scheduledBy,
                    [
                        'venue' => $data['venue'] ?? null,
                        'scheduled_date' => $date,
                        'scheduled_time' => $time,
                    ]
                );
            }

            $this->workflowService->transition(
                $proposal,
                'schedule_defence',
                $scheduledBy,
                "Open defence scheduled for {$date} at ".($data['venue'] ?? 'TBD')
            );

            return $session->fresh();
        });
    }

    /**
     * Process the defence result after all scores are submitted. Delegates the actual
     * scoring to ReviewScoreService::recalculateSnapshot() — the single source of truth
     * for blind/defence/combined scoring — so a manual "finalize" action here always
     * agrees with the automatic decision made when the last score is submitted.
     *
     * The pass/fail rule itself is decided by recalculateSnapshot()'s `combined_passes`,
     * which respects the configurable `combined_decision_mode` setting (see
     * ReviewScoreService::combinedDecisionMode()) — never hardcoded here.
     */
    public function processDefenceResult(DefenceSession $session, User $decidedBy): Proposal
    {
        $proposal = $session->proposal;
        $snapshot = $this->reviewScoreService->recalculateSnapshot($proposal);

        $blindScore = $snapshot['blind']['score'] ?? 0.0;
        $defenceScore = $snapshot['defence']['score'] ?? 0.0;
        $combinedScore = $snapshot['combined'];
        $threshold = $snapshot['combined_threshold'];
        $defenceThreshold = $snapshot['defence_threshold'];
        $mode = $snapshot['decision_mode'];
        $defenceBelowThreshold = $snapshot['defence_below_threshold'] ?? false;
        $passes = $snapshot['combined_passes'] ?? false;

        $session->update(['final_score' => $combinedScore, 'status' => 'completed']);

        $defenceNote = match (true) {
            ! $defenceBelowThreshold => '',
            $mode === 'strict_all' => " Open defence score ({$defenceScore} < {$defenceThreshold}) did not individually clear its threshold — required under the 'strict' decision mode.",
            default => " Note: open defence score is below its own threshold ({$defenceScore} < {$defenceThreshold}) — flagged for central evaluation.",
        };

        $metadata = [
            'blind_score' => $blindScore, 'defence_score' => $defenceScore, 'combined' => $combinedScore,
            'defence_threshold' => $defenceThreshold, 'defence_below_threshold' => $defenceBelowThreshold,
            'decision_mode' => $mode,
        ];

        if ($passes) {
            return $this->workflowService->transition(
                $proposal,
                'pass_defence',
                $decidedBy,
                "Defence passed. Combined score: {$combinedScore}. Threshold: {$threshold}.{$defenceNote}",
                $metadata
            );
        }

        return $this->workflowService->transition(
            $proposal,
            'fail_defence',
            $decidedBy,
            "Defence failed. Combined score: {$combinedScore}. Threshold: {$threshold}.{$defenceNote}",
            $metadata
        );
    }
}
