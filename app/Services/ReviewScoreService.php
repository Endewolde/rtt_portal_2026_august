<?php

namespace App\Services;

use App\Exceptions\InvalidScoreException;
use App\Exceptions\InvalidTransitionException;
use App\Exceptions\ReviewAlreadySubmittedException;
use App\Exceptions\UnauthorizedReviewException;
use App\Exceptions\UnauthorizedTransitionException;
use App\Models\DefenceSession;
use App\Models\EvaluationQuestion;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReviewScoreService
{
    public function __construct(private readonly WorkflowService $workflowService) {}

    /**
     * Submit all scores for a review assignment.
     *
     * @param  array  $answers  Array of { question_id, score, comment, recommendation }
     *
     * @throws ReviewAlreadySubmittedException
     * @throws InvalidScoreException
     */
    public function submitScore(
        ReviewAssignment $assignment,
        array $answers,
        User $reviewer
    ): ReviewAssignment {
        // This was previously unchecked — any authenticated user hitting the endpoint
        // directly (not just via the UI, which only ever links a reviewer to their own
        // assignments) could submit a score for someone else's review assignment.
        if ($assignment->reviewer_id !== $reviewer->id) {
            throw new UnauthorizedReviewException;
        }

        if ($assignment->status === 'submitted') {
            throw new ReviewAlreadySubmittedException('This review has already been submitted.');
        }

        // A reviewer who declared a conflict of interest must never be able to score
        // this proposal, regardless of what the frontend does or doesn't show them.
        if ($assignment->coi_has_conflict) {
            throw new InvalidScoreException('You have declared a conflict of interest on this review and cannot submit a score.');
        }

        // Issue 2: Block open-defence submissions outside the scheduled date
        $this->assertDefenceDateWindow($assignment);

        foreach ($answers as $answer) {
            $question = EvaluationQuestion::findOrFail($answer['question_id']);
            if ($answer['score'] > $question->max_score || $answer['score'] < 0) {
                throw new InvalidScoreException(
                    "Score {$answer['score']} is invalid for question '{$question->question_text}'. Max: {$question->max_score}"
                );
            }
        }

        // A required question left unanswered would otherwise be silently excluded from
        // both the numerator and denominator when the score is calculated, inflating the
        // percentage instead of dragging it down. The frontend already blocks this, but it
        // must be enforced here too since this endpoint can be called directly.
        $assignment->loadMissing('evaluationType.categories.questions');
        $requiredQuestionIds = ($assignment->evaluationType?->categories ?? collect())
            ->flatMap(fn ($category) => $category->questions)
            ->where('is_required', true)
            ->pluck('id');
        $answeredQuestionIds = collect($answers)->pluck('question_id');
        $missing = $requiredQuestionIds->diff($answeredQuestionIds);

        if ($missing->isNotEmpty()) {
            throw new InvalidScoreException('All required questions must be answered before submitting.');
        }

        DB::transaction(function () use ($assignment, $answers) {
            foreach ($answers as $answer) {
                ReviewScore::updateOrCreate(
                    [
                        'review_assignment_id' => $assignment->id,
                        'evaluation_question_id' => $answer['question_id'],
                    ],
                    [
                        'score' => $answer['score'],
                        'comment' => $answer['comment'] ?? null,
                        'recommendation' => $answer['recommendation'] ?? null,
                    ]
                );
            }

            $assignment->update([
                'status' => 'submitted',
                'submitted_at' => now(),
            ]);
        });

        // Issue 1: Auto-trigger phase transitions — wrapped in try/catch so a
        // transition failure never rolls back the already-committed score save.
        try {
            $proposal = $assignment->proposal->fresh();
            $this->processBlindReviewResult($proposal);
            $this->processOpenDefenceResultIfComplete($proposal->fresh());
        } catch (\Throwable $e) {
            Log::error('Auto-transition failed after score submission', [
                'assignment_id' => $assignment->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $assignment->fresh();
    }

    /**
     * Block open-defence score submissions outside the scheduled date.
     * Reviews can only be submitted on the calendar day of the session.
     *
     * @throws \RuntimeException
     */
    private function assertDefenceDateWindow(ReviewAssignment $assignment): void
    {
        $assignment->loadMissing('evaluationType');
        $typeName = $assignment->evaluationType?->name ?? '';

        if (! str_starts_with($typeName, 'open_defence')) {
            return; // Blind-review assignments have no date restriction
        }

        $session = DefenceSession::where('proposal_id', $assignment->proposal_id)
            ->where('status', 'scheduled')
            ->latest()
            ->first();

        if (! $session) {
            throw new \RuntimeException('No active defence session found for this proposal.');
        }

        $scheduledDate = Carbon::parse($session->scheduled_date)->startOfDay();
        $today = Carbon::today();

        if ($today->lt($scheduledDate)) {
            throw new \RuntimeException(
                'The open defence session has not started yet. '
                .'Scores can only be submitted on '.$scheduledDate->format('M d, Y').'.'
            );
        }

        if ($today->gt($scheduledDate)) {
            throw new \RuntimeException(
                'The open defence session date has passed ('.$scheduledDate->format('M d, Y').'). '
                .'Scores can no longer be submitted for this session.'
            );
        }
    }

    /**
     * Calculate the normalized score (0–100) for a completed assignment.
     *
     * When every category in the evaluation type has a weight defined, the
     * score is weighted:
     *   category_pct  = sum(category_scores) / sum(category_max_scores)
     *   weighted_score = Σ(category_pct × category_weight)
     *   final          = (weighted_score / total_weight) × 100
     *
     * When no weights are set, falls back to:
     *   sum(all_scores) / sum(all_max_scores) × 100
     */
    public function calculateScore(ReviewAssignment $assignment): float
    {
        $categories = $this->categoryBreakdown($assignment);

        if ($categories->isEmpty()) {
            return 0.0;
        }

        $allHaveWeight = $categories->every(fn ($c) => $c['weight'] > 0);

        if ($allHaveWeight) {
            $weightedSum = 0.0;
            $totalWeight = 0.0;

            foreach ($categories as $c) {
                $catPct = $c['max'] > 0 ? $c['earned'] / $c['max'] : 0.0;
                $weightedSum += $catPct * $c['weight'];
                $totalWeight += $c['weight'];
            }

            return $totalWeight > 0 ? round(($weightedSum / $totalWeight) * 100, 2) : 0.0;
        }

        $totalScore = $categories->sum('earned');
        $totalMaxScore = $categories->sum('max');

        return $totalMaxScore > 0 ? round(($totalScore / $totalMaxScore) * 100, 2) : 0.0;
    }

    /**
     * Return the raw weighted score and the maximum possible score for display.
     * Uses category weights when all categories have a weight; otherwise returns
     * raw question points and total max.
     *
     * @return array{score: float, max: float}
     */
    public function calculateWeightedDisplay(ReviewAssignment $assignment): array
    {
        $categories = $this->categoryBreakdown($assignment);

        if ($categories->isEmpty()) {
            return ['score' => 0.0, 'max' => 0.0];
        }

        $allHaveWeight = $categories->every(fn ($c) => $c['weight'] > 0);

        if ($allHaveWeight) {
            $weightedSum = 0.0;
            $totalWeight = 0.0;

            foreach ($categories as $c) {
                $catPct = $c['max'] > 0 ? $c['earned'] / $c['max'] : 0.0;
                $weightedSum += $catPct * $c['weight'];
                $totalWeight += $c['weight'];
            }

            return ['score' => round($weightedSum, 2), 'max' => $totalWeight];
        }

        return ['score' => (float) $categories->sum('earned'), 'max' => (float) $categories->sum('max')];
    }

    /**
     * Per-category earned/max points for an assignment, computed from EVERY question
     * defined on the assignment's evaluation type — not only the questions that were
     * actually scored. This matters: a category (or a required question) left entirely
     * unscored must still count its full weight/max toward the denominator, otherwise
     * an incomplete submission can inflate the percentage instead of dragging it down.
     *
     * @return Collection<int, array{weight: float, earned: float, max: float}>
     */
    private function categoryBreakdown(ReviewAssignment $assignment): Collection
    {
        $assignment->loadMissing('evaluationType.categories.questions');

        $categories = $assignment->evaluationType?->categories ?? collect();

        if ($categories->isEmpty()) {
            return collect();
        }

        // Reuse an already eager-loaded `scores` relation when the caller preloaded
        // it (e.g. Central Evaluation's queue) instead of re-querying per assignment.
        $scoresByQuestion = $assignment->relationLoaded('scores')
            ? $assignment->scores->pluck('score', 'evaluation_question_id')
            : ReviewScore::where('review_assignment_id', $assignment->id)->pluck('score', 'evaluation_question_id');

        return $categories->map(function ($category) use ($scoresByQuestion) {
            $earned = 0.0;
            $max = 0.0;

            foreach ($category->questions as $question) {
                $max += $question->max_score;
                $earned += (float) ($scoresByQuestion[$question->id] ?? 0);
            }

            return ['weight' => (float) $category->weight, 'earned' => $earned, 'max' => $max];
        });
    }

    /**
     * Read a threshold setting's live, user-configured value — no hardcoded fallback
     * number. If it isn't configured, that's a real misconfiguration: it's logged and
     * treated as 0 (a fail-safe "no bar set" rather than guessing a business number).
     */
    private function thresholdValue(string $key): float
    {
        $value = DB::table('threshold_settings')->where('key', $key)->value('value');

        if ($value === null) {
            Log::error("Threshold setting '{$key}' is not configured in threshold_settings.");

            return 0.0;
        }

        return (float) $value;
    }

    /**
     * Which rule decides whether a proposal advances past open defence — configurable
     * from Settings > Review Thresholds, never hardcoded:
     *   - 'combined_only' (default): (blind + defence) >= combined_threshold is the
     *     sole gate. defence_threshold is informational only.
     *   - 'strict_all': blind must ALSO individually clear blind_threshold, defence
     *     must ALSO individually clear defence_threshold, in addition to the combined
     *     total clearing combined_threshold — all three must hold.
     */
    private function combinedDecisionMode(): string
    {
        $value = DB::table('app_settings')->where('key', 'combined_decision_mode')->value('value');

        return in_array($value, ['combined_only', 'strict_all'], true) ? $value : 'combined_only';
    }

    /**
     * Live, read-only snapshot of a proposal's blind review / open defence scores
     * against the CURRENT threshold settings and CURRENT evaluation-criteria weights —
     * recomputed fresh every call, never cached or persisted. Used both to decide the
     * automatic pass/fail transitions below and to power an on-demand "Recalculate"
     * action so staff can always confirm a proposal's numbers are up to date, even
     * after editing thresholds or evaluation criteria post-decision.
     *
     * @return array{
     *     blind: array{score: float, max: float}|null,
     *     defence: array{score: float, max: float}|null,
     *     combined: float,
     *     combined_max: float,
     *     blind_threshold: float,
     *     defence_threshold: float,
     *     combined_threshold: float,
     *     decision_mode: string,
     *     blind_passes: bool|null,
     *     defence_below_threshold: bool|null,
     *     combined_passes: bool|null,
     * }
     */
    public function recalculateSnapshot(Proposal $proposal): array
    {
        // Reuse an already eager-loaded `reviewAssignments` relation when the caller
        // preloaded it (e.g. Central Evaluation's queue) instead of re-querying per
        // proposal; otherwise fall back to the original per-call query unchanged.
        if ($proposal->relationLoaded('reviewAssignments')) {
            $submitted = $proposal->reviewAssignments->where('status', 'submitted');
            $blindAssignments = $submitted->filter(fn ($a) => str_starts_with($a->evaluationType?->name ?? '', 'blind_review'))->values();
            $defenceAssignments = $submitted->filter(fn ($a) => str_starts_with($a->evaluationType?->name ?? '', 'open_defence'))->values();
        } else {
            $blindAssignments = ReviewAssignment::where('proposal_id', $proposal->id)
                ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'blind_review%'))
                ->where('status', 'submitted')
                ->get();
            $defenceAssignments = ReviewAssignment::where('proposal_id', $proposal->id)
                ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
                ->where('status', 'submitted')
                ->get();
        }

        $blindDisplayInfos = $blindAssignments->map(fn ($a) => $this->calculateWeightedDisplay($a));
        $defenceDisplayInfos = $defenceAssignments->map(fn ($a) => $this->calculateWeightedDisplay($a));

        $blind = $blindDisplayInfos->isNotEmpty()
            ? ['score' => round($blindDisplayInfos->avg('score'), 2), 'max' => $blindDisplayInfos->first()['max']]
            : null;
        $defence = $defenceDisplayInfos->isNotEmpty()
            ? ['score' => round($defenceDisplayInfos->avg('score'), 2), 'max' => $defenceDisplayInfos->first()['max']]
            : null;

        $combined = ($blind['score'] ?? 0.0) + ($defence['score'] ?? 0.0);
        $combinedMax = ($blind['max'] ?? 0.0) + ($defence['max'] ?? 0.0);

        $blindThreshold = $this->thresholdValue('blind_threshold');
        $defenceThreshold = $this->thresholdValue('defence_threshold');
        $combinedThreshold = $this->thresholdValue('combined_threshold');
        $mode = $this->combinedDecisionMode();

        $blindPasses = $blind === null ? null : $blind['score'] >= $blindThreshold;
        $defenceBelowThreshold = $defence === null ? null : $defence['score'] < $defenceThreshold;
        $meetsCombinedBar = $defence === null ? null : $combined >= $combinedThreshold;

        $combinedPasses = match (true) {
            $defence === null => null,
            $mode === 'strict_all' => ($blindPasses ?? false) && ! $defenceBelowThreshold && $meetsCombinedBar,
            default => $meetsCombinedBar,
        };

        return [
            'blind' => $blind,
            'defence' => $defence,
            'combined' => round($combined, 2),
            'combined_max' => $combinedMax,
            'blind_threshold' => $blindThreshold,
            'defence_threshold' => $defenceThreshold,
            'combined_threshold' => $combinedThreshold,
            'decision_mode' => $mode,
            'blind_passes' => $blindPasses,
            'defence_below_threshold' => $defenceBelowThreshold,
            'combined_passes' => $combinedPasses,
        ];
    }

    /**
     * When all open-defence scores are in, calculate the combined (blind + defence)
     * raw score and automatically transition the proposal to accepted or rejected.
     * Mirrors processBlindReviewResult — no manual trigger needed.
     *
     * The actual pass/fail rule is decided by recalculateSnapshot()'s `combined_passes`,
     * which respects the configurable `combined_decision_mode` setting:
     *   - 'combined_only' (default): combined_threshold is the sole gate; defence_threshold
     *     is informational only (recorded but doesn't block advancement).
     *   - 'strict_all': blind, defence, AND combined must each individually clear their
     *     own threshold.
     * Never hardcode this rule here — always read it from the snapshot.
     */
    public function processOpenDefenceResultIfComplete(Proposal $proposal): void
    {
        if ($proposal->status !== 'under_open_defence') {
            return;
        }

        $defenceAssignments = ReviewAssignment::where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
            ->get();

        if ($defenceAssignments->isEmpty()) {
            return;
        }

        // Wait until every assigned reviewer has submitted
        if (! $defenceAssignments->every(fn ($a) => $a->status === 'submitted')) {
            return;
        }

        $snapshot = $this->recalculateSnapshot($proposal);
        $blindRaw = $snapshot['blind']['score'] ?? 0.0;
        $blindMax = $snapshot['blind']['max'] ?? 0.0;
        $defenceRaw = $snapshot['defence']['score'] ?? 0.0;
        $defenceMax = $snapshot['defence']['max'] ?? 0.0;
        $combined = $snapshot['combined'];
        $combinedMax = $snapshot['combined_max'];
        $defenceThreshold = $snapshot['defence_threshold'];
        $combinedThreshold = $snapshot['combined_threshold'];
        $mode = $snapshot['decision_mode'];
        $defenceBelowThreshold = $snapshot['defence_below_threshold'] ?? false;

        $systemActor = User::role('central_officer')->first()
            ?? User::role('super_admin')->first();

        if (! $systemActor) {
            Log::error('processOpenDefenceResultIfComplete: no system actor found (central_officer or super_admin).');

            return;
        }

        $blindLabel = $blindMax > 0 ? "{$blindRaw}/{$blindMax}" : (string) $blindRaw;
        $defenceLabel = $defenceMax > 0 ? "{$defenceRaw}/{$defenceMax}" : (string) $defenceRaw;

        $passes = $snapshot['combined_passes'] ?? false;
        $action = $passes ? 'pass_defence' : 'fail_defence';
        $outcome = $passes ? 'passed' : 'failed';
        $defenceNote = match (true) {
            ! $defenceBelowThreshold => '',
            $mode === 'strict_all' => " Open defence score ({$defenceRaw} < {$defenceThreshold}) did not individually clear its threshold — required under the 'strict' decision mode.",
            default => " Note: open defence score is below its own threshold ({$defenceRaw} < {$defenceThreshold}) — flagged for central evaluation.",
        };

        DB::transaction(function () use (
            $proposal, $combined, $combinedMax, $action, $outcome, $systemActor,
            $blindRaw, $defenceRaw, $defenceThreshold, $combinedThreshold, $defenceBelowThreshold, $mode,
            $blindLabel, $defenceLabel, $defenceNote
        ) {
            DefenceSession::where('proposal_id', $proposal->id)
                ->where('status', 'scheduled')
                ->latest()
                ->update(['final_score' => $combined, 'status' => 'completed']);

            $this->workflowService->transition(
                $proposal,
                $action,
                $systemActor,
                "Defence {$outcome} automatically. Blind: {$blindLabel}, Defence: {$defenceLabel}. "
                    ."Combined: {$combined}/{$combinedMax}. Combined threshold: {$combinedThreshold}.{$defenceNote}",
                [
                    'blind_score' => $blindRaw, 'defence_score' => $defenceRaw,
                    'combined' => $combined, 'combined_max' => $combinedMax,
                    'defence_threshold' => $defenceThreshold, 'combined_threshold' => $combinedThreshold,
                    'defence_below_threshold' => $defenceBelowThreshold, 'decision_mode' => $mode,
                ]
            );
        });
    }

    /**
     * Check if all reviewers submitted. If yes, calculate the raw weighted average and
     * transition the proposal. `blind_threshold` is a RAW point value against the blind
     * review evaluation type's actual category-weight sum (e.g. 60 out of a possible 80)
     * — not a normalized 0–100 percentage.
     */
    public function processBlindReviewResult(Proposal $proposal): void
    {
        if ($proposal->status !== 'under_blind_review') {
            return;
        }

        $assignments = ReviewAssignment::where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'blind_review%'))
            ->get();

        if ($assignments->isEmpty()) {
            return;
        }

        $allSubmitted = $assignments->every(fn ($a) => $a->status === 'submitted');

        if (! $allSubmitted) {
            return;
        }

        $displayInfos = $assignments->map(fn ($a) => $this->calculateWeightedDisplay($a));
        $rawAvg = round($displayInfos->avg('score'), 2);
        $rawMax = $displayInfos->first()['max'];
        $scoreLabel = $rawMax > 0 ? "{$rawAvg}/{$rawMax}" : (string) $rawAvg;

        $threshold = $this->thresholdValue('blind_threshold');

        $systemActor = User::role('central_officer')->first()
            ?? User::role('super_admin')->first();

        if ($rawAvg >= $threshold) {
            $this->workflowService->transition(
                $proposal,
                'pass_blind_review',
                $systemActor,
                "Blind review passed. Average score: {$scoreLabel}. Threshold: {$threshold}.",
                ['average_score' => $rawAvg, 'score_label' => $scoreLabel, 'threshold' => $threshold]
            );
        } else {
            $this->workflowService->transition(
                $proposal,
                'fail_blind_review',
                $systemActor,
                "Blind review failed. Average score: {$scoreLabel}. Threshold: {$threshold}.",
                ['average_score' => $rawAvg, 'score_label' => $scoreLabel, 'threshold' => $threshold]
            );
        }
    }

    /**
     * Manual admin action: pull a proposal out of blind review (under_blind_review or
     * blind_review_passed) when the issue isn't a scoring problem but something noticed
     * during review that means it should never have reached this stage — duplicate,
     * ineligible, plagiarism, etc. The automatic score-based correction
     * (reviews:correct-blind-review) only fires for scoring mismatches, so this is the
     * manual counterpart for everything else.
     *
     * @throws InvalidTransitionException|UnauthorizedTransitionException
     */
    public function rejectFromBlindReview(Proposal $proposal, User $actor, string $reason): Proposal
    {
        return $this->workflowService->transition(
            $proposal,
            'fail_blind_review',
            $actor,
            $reason,
            ['manual' => true]
        );
    }
}
