<?php

namespace App\Services;

use App\Exceptions\BlindReviewPhaseIncompleteException;
use App\Models\DefenceSession;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
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
        // College-scoped reviewers-in-charge wait until their college finishes blind review.
        return $actor->accessScope()->isCollege();
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
     * The proposal's active defence session and its open-defence reviewers, for the
     * Schedule Defence page in edit mode.
     *
     * @return array{session: DefenceSession|null, assignments: Collection<int, ReviewAssignment>}
     */
    public function current(Proposal $proposal): array
    {
        return [
            'session' => DefenceSession::where('proposal_id', $proposal->id)->where('status', 'scheduled')->latest()->first(),
            'assignments' => $this->defenceAssignments($proposal)->with(['reviewer:id,name,email,title', 'evaluationType:id,name,label'])->get(),
        ];
    }

    /**
     * Update an open defence that is already under way: date, time, venue and link,
     * plus its reviewer panel — newly selected reviewers are assigned and notified,
     * deselected ones removed (never one who already submitted a score). Changing the
     * date resets the score deadline to the day after the new date.
     *
     * @param  array{scheduled_date: string, scheduled_time: string, venue: string, online_link?: string|null, reviewer_ids?: array<int, string>, evaluation_type_id?: string|null, override_workload_cap?: bool}  $data
     * @return array{session: DefenceSession, added: int, removed: int, kept_submitted: array<int, string>}
     *
     * @throws \Exception
     */
    public function update(Proposal $proposal, array $data, User $actor): array
    {
        if ($proposal->status !== 'under_open_defence') {
            throw new \Exception('Only a proposal currently in open defence can have its defence updated.');
        }

        $current = $this->defenceAssignments($proposal)->get();
        // Leaving reviewer_ids out keeps the panel as it is; only an explicit list changes it.
        $requested = array_key_exists('reviewer_ids', $data) && $data['reviewer_ids'] !== null
            ? collect($data['reviewer_ids'])->unique()->values()
            : $current->pluck('reviewer_id')->values();
        $toAdd = $requested->diff($current->pluck('reviewer_id'))->values();
        $toRemove = $current->reject(fn (ReviewAssignment $a) => $requested->contains($a->reviewer_id));
        $keptSubmitted = $toRemove->where('status', 'submitted');
        $toRemove = $toRemove->where('status', '!=', 'submitted');

        if ($requested->isEmpty() && $keptSubmitted->isEmpty()) {
            throw new \Exception('An open defence needs at least one panel member. Add a reviewer before removing the last one.');
        }

        $evaluationTypeId = $data['evaluation_type_id'] ?? $current->first()?->evaluation_type_id;
        if ($toAdd->isNotEmpty() && ! $evaluationTypeId) {
            throw new \Exception('Select the open defence evaluation type before assigning reviewers.');
        }

        $dueDate = Carbon::parse($data['scheduled_date'])->addDay()->toDateString();

        $session = DB::transaction(function () use ($proposal, $data, $actor, $toAdd, $toRemove, $evaluationTypeId, $dueDate) {
            $session = DefenceSession::where('proposal_id', $proposal->id)->where('status', 'scheduled')->latest()->first();
            $dateChanged = ! $session || $session->scheduled_date->toDateString() !== Carbon::parse($data['scheduled_date'])->toDateString();

            if ($dateChanged && $session?->attendance === DefenceAttendanceService::HELD) {
                throw new \Exception('This defence has already been recorded as held, so its date can no longer be changed.');
            }

            $attributes = [
                'scheduled_date' => $data['scheduled_date'],
                'scheduled_time' => $data['scheduled_time'],
                'venue' => $data['venue'],
                'online_link' => $data['online_link'] ?? null,
            ];

            if ($session) {
                // A new defence date means a new score deadline (day after it) — an
                // extension granted for the old date no longer applies.
                // Scores given for the old date were for a defence that didn't happen
                // then: the panel scores again at the new one.
                $session->update($attributes + ($dateChanged
                    ? [
                        'score_deadline_extended_until' => null, 'deadline_reminder_sent_at' => null, 'flagged_incomplete_at' => null,
                        'attendance_requested_at' => null, 'absence_reported_by' => null, 'absence_reported_at' => null, 'absence_report_note' => null,
                    ]
                    : []));
                if ($dateChanged) {
                    $this->defenceAssignments($proposal)->where('status', 'submitted')->update(['status' => 'pending', 'submitted_at' => null]);
                }
            } else {
                $session = DefenceSession::create($attributes + [
                    'proposal_id' => $proposal->id,
                    'status' => 'scheduled',
                    'scheduled_by' => $actor->id,
                ]);
            }

            if ($toRemove->isNotEmpty()) {
                ReviewAssignment::whereIn('id', $toRemove->pluck('id'))->delete();
            }

            if ($dateChanged) {
                $this->defenceAssignments($proposal)->where('status', '!=', 'submitted')->update(['due_date' => $dueDate]);
            }

            if ($toAdd->isNotEmpty()) {
                $this->reviewAssignmentService->assign(
                    $proposal,
                    $toAdd->all(),
                    $evaluationTypeId,
                    $actor,
                    ['venue' => $data['venue'], 'scheduled_date' => $data['scheduled_date'], 'scheduled_time' => $data['scheduled_time']],
                    $dueDate,
                    (bool) ($data['override_workload_cap'] ?? false)
                );
            }

            return $session->fresh();
        });

        // Removing the only reviewers still to score can leave everyone else finished.
        if ($toRemove->isNotEmpty() && $toAdd->isEmpty()) {
            $this->reviewScoreService->processOpenDefenceResultIfComplete($proposal->fresh());
        }

        return [
            'session' => $session,
            'added' => $toAdd->count(),
            'removed' => $toRemove->count(),
            'kept_submitted' => $keptSubmitted->map(fn (ReviewAssignment $a) => $a->reviewer?->name ?? 'A reviewer')->values()->all(),
        ];
    }

    /** Open-defence reviewer assignments that are still part of the panel. */
    private function defenceAssignments(Proposal $proposal)
    {
        return ReviewAssignment::where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
            ->whereNotIn('status', ['declined', 'cancelled', 'voided']);
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
        if ($session->attendance !== DefenceAttendanceService::HELD) {
            throw new \Exception('Confirm that the defence was held (or record that the team did not appear) before deciding the result.');
        }

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
