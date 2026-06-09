<?php

namespace App\Services;

use App\Models\DefenceSession;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
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
                'proposal_id'    => $proposal->id,
                'scheduled_date' => $date,
                'scheduled_time' => $time,
                'venue'          => $data['venue'],
                'online_link'    => $data['online_link'] ?? null,
                'status'         => 'scheduled',
                'scheduled_by'   => $scheduledBy->id,
            ]);

            if (! empty($data['reviewer_ids']) && ! empty($data['evaluation_type_id'])) {
                $this->reviewAssignmentService->assign(
                    $proposal,
                    $data['reviewer_ids'],
                    $data['evaluation_type_id'],
                    $scheduledBy
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
     * Process the defence result after all scores are submitted.
     * combined = blind_review_score_avg + open_defence_score_avg
     */
    public function processDefenceResult(DefenceSession $session, User $decidedBy): Proposal
    {
        $proposal = $session->proposal;

        $blindAssignments = ReviewAssignment::where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'blind_review%'))
            ->where('status', 'submitted')
            ->get();

        $blindScore = $blindAssignments->isNotEmpty()
            ? $blindAssignments->map(fn ($a) => $this->reviewScoreService->calculateScore($a))->avg()
            : 0;

        $defenceAssignments = ReviewAssignment::where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
            ->where('status', 'submitted')
            ->get();

        $defenceScore = $defenceAssignments->isNotEmpty()
            ? $defenceAssignments->map(fn ($a) => $this->reviewScoreService->calculateScore($a))->avg()
            : 0;

        $combinedScore = $blindScore + $defenceScore;

        $threshold = (float) (DB::table('threshold_settings')
            ->where('key', 'combined_threshold')
            ->value('value') ?? 120);

        $session->update(['final_score' => $combinedScore, 'status' => 'completed']);

        if ($combinedScore >= $threshold) {
            return $this->workflowService->transition(
                $proposal,
                'pass_defence',
                $decidedBy,
                "Defence passed. Combined score: {$combinedScore}. Threshold: {$threshold}.",
                ['blind_score' => $blindScore, 'defence_score' => $defenceScore, 'combined' => $combinedScore]
            );
        }

        return $this->workflowService->transition(
            $proposal,
            'fail_defence',
            $decidedBy,
            "Defence failed. Combined score: {$combinedScore}. Threshold: {$threshold}.",
            ['blind_score' => $blindScore, 'defence_score' => $defenceScore, 'combined' => $combinedScore]
        );
    }
}
