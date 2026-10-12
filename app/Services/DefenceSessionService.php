<?php

namespace App\Services;

use App\Exceptions\BlindReviewPhaseIncompleteException;
use App\Models\DefenceSession;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DefenceSessionService
{
    public function __construct(
        private readonly WorkflowService $workflowService,
        private readonly ReviewScoreService $reviewScoreService,
        private readonly ReviewAssignmentService $reviewAssignmentService
    ) {}

    /**
     * Roles that schedule defences across colleges and are therefore never held back
     * by a single college's unfinished blind review phase.
     *
     * @var list<string>
     */
    private const CROSS_COLLEGE_ROLES = [
        'super_admin', 'admin', 'central_officer',
        'research_officer', 'community_officer', 'technology_officer',
    ];

    /**
     * Proposals from the same college (and academic year) that have not finished the
     * blind review phase yet — either still awaiting reviewer assignment (validated)
     * or awaiting reviewer scores (under_blind_review).
     *
     * @return Collection<int, array{id: string, tracker_number: string|null, title: string|null, status: string}>
     */
    public function pendingBlindReviewProposals(Proposal $proposal): Collection
    {
        return $this->pendingBlindReviewForCollege($proposal->college_id, $proposal->academic_year);
    }

    /**
     * College-wide variant used before a specific proposal is picked (e.g. when a
     * college officer opens Open Defence from the sidebar). A null academic year
     * checks every year.
     *
     * @return Collection<int, array{id: string, tracker_number: string|null, title: string|null, status: string}>
     */
    public function pendingBlindReviewForCollege(?string $collegeId, ?string $academicYear): Collection
    {
        if (! $collegeId) {
            return collect();
        }

        return Proposal::query()
            ->where('college_id', $collegeId)
            ->whereIn('status', ['validated', 'under_blind_review'])
            ->when($academicYear, fn ($q) => $q->where('academic_year', $academicYear))
            ->orderBy('tracker_number')
            ->get(['id', 'tracker_number', 'title', 'status'])
            ->map(fn (Proposal $p) => [
                'id' => $p->id,
                'tracker_number' => $p->tracker_number,
                'title' => $p->title,
                'status' => $p->status,
            ])
            ->values();
    }

    /**
     * Whether this actor is held to the college-wide blind review gate — college
     * officers are; central/category-level officers are not.
     */
    public function isBoundByCollegeBlindReviewGate(User $actor): bool
    {
        return $actor->hasRole('college_officer') && ! $actor->hasAnyRole(self::CROSS_COLLEGE_ROLES);
    }

    /**
     * A college officer may only move their college into the open defence phase once
     * every one of the college's proposals has finished blind review.
     *
     * @throws BlindReviewPhaseIncompleteException
     */
    public function assertCollegeBlindReviewComplete(Proposal $proposal, User $actor): void
    {
        if (! $this->isBoundByCollegeBlindReviewGate($actor)) {
            return;
        }

        $pending = $this->pendingBlindReviewProposals($proposal);

        if ($pending->isNotEmpty()) {
            throw new BlindReviewPhaseIncompleteException(
                $proposal->college?->name ?? 'your college',
                $pending
            );
        }
    }

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

        $this->assertCollegeBlindReviewComplete($proposal, $scheduledBy);

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
                    ],
                    // Defence scores are due by the end of the day after the defence.
                    Carbon::parse($date)->addDay()->toDateString()
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
