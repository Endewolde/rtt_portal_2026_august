<?php

namespace App\Services;

use App\Exceptions\DefenceScoringClosedException;
use App\Exceptions\InvalidScoreException;
use App\Exceptions\InvalidTransitionException;
use App\Exceptions\ReviewAlreadySubmittedException;
use App\Exceptions\UnauthorizedReviewException;
use App\Exceptions\UnauthorizedTransitionException;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\DefenceSession;
use App\Models\EvaluationQuestion;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReviewScoreService
{
    public const DEFENCE_DEADLINE_PASSED_MESSAGE = 'You cannot submit right now. Result submission must be done in the assigned defence room '
        .'during the presentation period, or by the due date (one day after the defence). '
        .'For more information, please contact your college officer.';

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
     * Open-defence scores are accepted from the start of the defence day until the
     * session's score deadline — the end of the following day, or a later date from
     * an approved extension (see DefenceSession::scoreDeadline()).
     *
     * @throws DefenceScoringClosedException
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
            throw new DefenceScoringClosedException('No active defence session found for this proposal.');
        }

        if (now()->lt($session->scoringOpensAt())) {
            throw new DefenceScoringClosedException(
                'The open defence session has not started yet. '
                .'Scores can be submitted from '.$session->scoringOpensAt()->format('M d, Y').'.'
            );
        }

        if (now()->gt($session->scoreDeadline())) {
            throw new DefenceScoringClosedException(self::DEFENCE_DEADLINE_PASSED_MESSAGE);
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
                // A stored score can exceed the question's CURRENT max when the max was
                // lowered in Evaluation Criteria after scoring — never count more than
                // the question is now worth.
                $earned += min((float) ($scoresByQuestion[$question->id] ?? 0), (float) $question->max_score);
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

        $blind = $this->phaseScore($blindDisplayInfos);
        $defence = $this->phaseScore($defenceDisplayInfos);

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
     * Average a phase's per-reviewer scores, never exceeding the phase's maximum
     * possible score (reviewers scored on differently-weighted forms could otherwise
     * average above the max used for display and threshold comparison).
     *
     * @param  Collection<int, array{score: float, max: float}>  $displayInfos
     * @return array{score: float, max: float}|null
     */
    private function phaseScore(Collection $displayInfos): ?array
    {
        if ($displayInfos->isEmpty()) {
            return null;
        }

        $max = (float) $displayInfos->first()['max'];

        return ['score' => min(round($displayInfos->avg('score'), 2), $max), 'max' => $max];
    }

    /**
     * The two score-based decisions a proposal goes through, in workflow order.
     *
     * @var list<array{phase: string, pass: string, fail: string, passesKey: string, passedState: string, undecidedState: string}>
     */
    private const DECISION_PAIRS = [
        ['phase' => 'blind_review', 'pass' => 'pass_blind_review', 'fail' => 'fail_blind_review', 'passesKey' => 'blind_passes', 'passedState' => 'blind_review_passed', 'undecidedState' => 'under_blind_review'],
        ['phase' => 'open_defence', 'pass' => 'pass_defence', 'fail' => 'fail_defence', 'passesKey' => 'combined_passes', 'passedState' => 'accepted', 'undecidedState' => 'under_open_defence'],
    ];

    /**
     * Recalculate every proposal's blind-review AND open-defence pass/fail decision
     * against the CURRENT threshold settings and decision mode, called automatically
     * whenever an admin saves a threshold change (see SettingsController) so decisions
     * never go stale against settings that have since moved on. Deliberately
     * bidirectional at the admin's explicit request: a proposal can flip either way,
     * including an already-rejected one becoming blind_review_passed/accepted if it
     * now clears the bar (via WorkflowService::bypassRejectedStageSilently, then the
     * normal pass_blind_review/pass_defence transition — so the PI gets the same
     * accurate "you passed" notification as any other pass decision).
     *
     * The one line that's still never crossed: proposals that already progressed past
     * the decision point (funded and beyond) are never touched automatically, since
     * those may carry real financial/contractual consequences — those are reported in
     * `needs_review` for a human to act on via the manual "Reopen for Reconsideration"
     * action if appropriate. The same applies to any correction that fails outright
     * (e.g. a missing workflow transition).
     *
     * @return array{corrected: array<int, array<string, mixed>>, needs_review: array<int, array<string, mixed>>}
     */
    public function recalculateAllDecisions(User $systemActor): array
    {
        $corrected = [];
        $needsReview = [];

        foreach (self::DECISION_PAIRS as $pair) {
            foreach ($this->latestDecisionLogs($pair) as $log) {
                $proposal = Proposal::find($log->proposal_id);
                if (! $proposal) {
                    continue;
                }

                $this->correctDecision($proposal, $log, $pair, $systemActor, manual: false, corrected: $corrected, needsReview: $needsReview);
            }
        }

        return ['corrected' => $corrected, 'needs_review' => $needsReview];
    }

    /**
     * Dry run for a single proposal (optionally a single phase): which of its recorded
     * blind-review / open-defence decisions no longer match what the current thresholds and criteria would decide,
     * and whether each one can safely be corrected right now.
     *
     * @return list<array{phase: string, issue: string, change: string, score: string, applicable: bool, reason: string|null}>
     */
    public function previewDecisionCorrections(Proposal $proposal, ?string $phase = null): array
    {
        $plans = [];

        foreach ($this->decisionPairs($phase) as $pair) {
            $log = $this->latestDecisionLogs($pair, $proposal->id)->first();
            if (! $log) {
                continue;
            }

            $plan = $this->planCorrection($proposal, $log, $pair);
            if ($plan) {
                $plans[] = [
                    'phase' => $pair['phase'],
                    'issue' => $plan['issue'],
                    'change' => $plan['change'],
                    'score' => $plan['score'],
                    'applicable' => $plan['applicable'],
                    'reason' => $plan['reason'],
                ];
            }
        }

        return $plans;
    }

    /**
     * Manual, per-proposal counterpart of recalculateAllDecisions(): applies the
     * corrections previewDecisionCorrections() reports as applicable, recorded under
     * the acting officer rather than as an automatic system decision.
     *
     * @return array{corrected: array<int, array<string, mixed>>, needs_review: array<int, array<string, mixed>>}
     */
    public function applyDecisionCorrections(Proposal $proposal, User $actor, ?string $phase = null): array
    {
        $corrected = [];
        $needsReview = [];

        foreach ($this->decisionPairs($phase) as $pair) {
            $log = $this->latestDecisionLogs($pair, $proposal->id)->first();
            if (! $log) {
                continue;
            }

            $this->correctDecision($proposal->fresh(), $log, $pair, $actor, manual: true, corrected: $corrected, needsReview: $needsReview);
        }

        return ['corrected' => $corrected, 'needs_review' => $needsReview];
    }

    /**
     * Every decision pair, or just the one for a single phase (blind_review / open_defence).
     *
     * @return list<array{phase: string, pass: string, fail: string, passesKey: string, passedState: string, undecidedState: string}>
     */
    private function decisionPairs(?string $phase): array
    {
        return array_values(array_filter(self::DECISION_PAIRS, fn ($pair) => $phase === null || $pair['phase'] === $phase));
    }

    /**
     * The most recent pass/fail decision log per proposal for one decision pair.
     *
     * @param  array{pass: string, fail: string}  $pair
     * @return Collection<string, object>
     */
    private function latestDecisionLogs(array $pair, ?string $proposalId = null): Collection
    {
        return DB::table('workflow_logs')
            ->whereIn('action', [$pair['pass'], $pair['fail']])
            ->when($proposalId, fn ($q) => $q->where('proposal_id', $proposalId))
            ->orderBy('created_at')
            ->get()
            ->groupBy('proposal_id')
            ->map(fn ($group) => $group->last());
    }

    /**
     * Compare a recorded decision with what current settings would decide. Null when
     * they agree (or there is nothing to recalculate / nothing safe to say).
     *
     * @param  array{pass: string, passesKey: string, passedState: string}  $pair
     * @return array{issue: string, change: string, score: string, applicable: bool, reason: string|null}|null
     */
    private function planCorrection(Proposal $proposal, object $log, array $pair): ?array
    {
        $snapshot = $this->recalculateSnapshot($proposal);
        $recalculatedPasses = $snapshot[$pair['passesKey']];
        if ($recalculatedPasses === null) {
            return null;
        }

        $recordedPass = $log->action === $pair['pass'];
        if ($recordedPass === $recalculatedPasses) {
            return null;
        }

        $score = $pair['passedState'] === 'blind_review_passed'
            ? "{$snapshot['blind']['score']}/{$snapshot['blind']['max']} (min {$snapshot['blind_threshold']})"
            : "{$snapshot['combined']}/{$snapshot['combined_max']} (min {$snapshot['combined_threshold']})";

        if ($recordedPass) {
            // Wrongly passed — only safe to correct while still sitting in the exact
            // state that decision produced (nothing built on it yet).
            $applicable = $proposal->status === $pair['passedState'];

            return [
                'issue' => 'wrongly_passed',
                'change' => "{$pair['passedState']} → rejected",
                'score' => $score,
                'applicable' => $applicable,
                'reason' => $applicable ? null : "already progressed to '{$proposal->status}' — correcting now would affect existing work built on top of it",
            ];
        }

        // Wrongly rejected. Only safe to correct while still sitting at rejected — if
        // someone already reopened/resolved it since, leave it alone rather than fight
        // whatever they did.
        if ($proposal->status !== 'rejected') {
            return null;
        }

        return [
            'issue' => 'wrongly_rejected',
            'change' => "rejected → {$pair['passedState']}",
            'score' => $score,
            'applicable' => true,
            'reason' => null,
        ];
    }

    /**
     * @param  array{pass: string, fail: string, passesKey: string, passedState: string, undecidedState: string}  $pair
     * @param  array<int, array<string, mixed>>  $corrected
     * @param  array<int, array<string, mixed>>  $needsReview
     */
    private function correctDecision(Proposal $proposal, object $log, array $pair, User $actor, bool $manual, array &$corrected, array &$needsReview): void
    {
        $plan = $this->planCorrection($proposal, $log, $pair);
        if (! $plan) {
            return;
        }

        $base = [
            'tracker_number' => $proposal->tracker_number, 'proposal_id' => $proposal->id,
            'issue' => $plan['issue'], 'score' => $plan['score'],
        ];

        if (! $plan['applicable']) {
            $needsReview[] = $base + ['current_status' => $proposal->status, 'reason' => $plan['reason']];

            return;
        }

        $scoreLabel = $plan['score'];
        $prefix = $manual ? "Corrected by {$actor->name} after recalculation" : 'Corrected automatically';
        $metadata = [
            'automatic' => ! $manual, 'manual' => $manual, 'corrected' => true,
            'score_label' => $scoreLabel, 'original_decision_at' => $log->created_at,
        ];

        try {
            if ($plan['issue'] === 'wrongly_passed') {
                $this->workflowService->transition(
                    $proposal,
                    $pair['fail'],
                    $actor,
                    "{$prefix}: score {$scoreLabel} no longer meets the threshold under current settings "
                        ."(originally decided on {$log->created_at} under different settings).",
                    $metadata
                );
            } else {
                DB::transaction(function () use ($proposal, $pair, $actor, $prefix, $scoreLabel, $log, $metadata) {
                    $this->workflowService->bypassRejectedStageSilently(
                        $proposal,
                        $pair['undecidedState'],
                        $actor,
                        "Recalculated under current settings: score {$scoreLabel} now clears the threshold "
                            ."(originally rejected on {$log->created_at} under different settings)."
                    );
                    $this->workflowService->transition(
                        $proposal,
                        $pair['pass'],
                        $actor,
                        "{$prefix}: score {$scoreLabel} now meets the threshold under current settings "
                            ."(originally rejected on {$log->created_at} under different settings).",
                        $metadata
                    );
                });
            }

            $corrected[] = $base + ['change' => $plan['change']];
        } catch (\Throwable $e) {
            $needsReview[] = $base + [
                'current_status' => $proposal->fresh()->status,
                'reason' => "correction failed: {$e->getMessage()}"
                    .($plan['issue'] === 'wrongly_rejected' ? ' — use "Reopen for Reconsideration" on the proposal to act on it manually' : ''),
            ];
        }
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
                    'automatic' => true,
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
    public function processBlindReviewResult(Proposal $proposal, ?string $moderationNote = null): void
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

        $threshold = $this->thresholdValue('blind_threshold');

        // Reviewers far apart (or on opposite sides of the pass mark): hold the
        // automatic decision until an officer adds a reviewer or moderates.
        if (! $moderationNote && ! $proposal->review_disagreement_resolved_at) {
            $disagreement = $this->blindDisagreement($assignments, $threshold);

            if ($disagreement) {
                $this->flagDisagreement($proposal, $disagreement);

                return;
            }

            if ($proposal->review_disagreement_flagged_at) {
                // A further reviewer brought the panel back into agreement.
                $proposal->forceFill(['review_disagreement' => null, 'review_disagreement_flagged_at' => null])->saveQuietly();
            }
        }

        $phase = $this->phaseScore($assignments->map(fn ($a) => $this->calculateWeightedDisplay($a)));
        $rawAvg = $phase['score'];
        $rawMax = $phase['max'];
        $scoreLabel = $rawMax > 0 ? "{$rawAvg}/{$rawMax}" : (string) $rawAvg;

        $systemActor = User::role('central_officer')->first()
            ?? User::role('super_admin')->first();

        $passes = $rawAvg >= $threshold;
        $note = ($passes ? 'Blind review passed.' : 'Blind review failed.')
            ." Average score: {$scoreLabel}. Threshold: {$threshold}."
            .($moderationNote ? " Decided despite reviewer disagreement — moderation note: {$moderationNote}" : '');

        $this->workflowService->transition(
            $proposal,
            $passes ? 'pass_blind_review' : 'fail_blind_review',
            $systemActor,
            $note,
            ['automatic' => true, 'average_score' => $rawAvg, 'score_label' => $scoreLabel, 'threshold' => $threshold]
                + ($moderationNote ? ['moderated' => true, 'moderation_note' => $moderationNote] : [])
        );
    }

    /**
     * Do the blind reviewers disagree too much for an automatic decision? Either the
     * gap between the highest and lowest score exceeds the configured share of the
     * maximum (Settings → review_disagreement_threshold_pct, 0 = off), or reviewers
     * fall on opposite sides of the pass mark.
     *
     * @param  Collection<int, ReviewAssignment>  $assignments  submitted blind-review assignments
     * @return array{scores: list<array{label: string, score: float, max: float, passes: bool}>, spread: float, spread_pct: float, threshold_pct: float, pass_mark: float, split_verdict: bool, reasons: list<string>}|null
     */
    public function blindDisagreement(Collection $assignments, ?float $passMark = null): ?array
    {
        $thresholdPct = (float) (DB::table('app_settings')->where('key', 'review_disagreement_threshold_pct')->value('value') ?? 25);

        if ($thresholdPct <= 0 || $assignments->count() < 2) {
            return null;
        }

        $passMark ??= $this->thresholdValue('blind_threshold');
        $letter = 'A';
        $scores = $assignments->values()->map(function (ReviewAssignment $a) use (&$letter, $passMark) {
            $display = $this->calculateWeightedDisplay($a);

            return [
                'label' => 'Reviewer '.$letter++,
                'score' => round(min($display['score'], $display['max']), 2),
                'max' => (float) $display['max'],
                'passes' => $display['score'] >= $passMark,
            ];
        });

        $max = (float) ($scores->max('max') ?: 0);
        $spread = round($scores->max('score') - $scores->min('score'), 2);
        $spreadPct = $max > 0 ? round($spread / $max * 100, 1) : 0.0;
        $splitVerdict = $scores->contains('passes', true) && $scores->contains('passes', false);

        $reasons = [];
        if ($spreadPct > $thresholdPct) {
            $reasons[] = "Scores differ by {$spread} points ({$spreadPct}% of the maximum; limit {$thresholdPct}%).";
        }
        if ($splitVerdict) {
            $reasons[] = "Some reviewers' scores pass the threshold of {$passMark} and others' fail it.";
        }

        if ($reasons === []) {
            return null;
        }

        return [
            'scores' => $scores->all(),
            'spread' => $spread,
            'spread_pct' => $spreadPct,
            'threshold_pct' => $thresholdPct,
            'pass_mark' => $passMark,
            'split_verdict' => $splitVerdict,
            'reasons' => $reasons,
        ];
    }

    /**
     * Officer decides a held proposal with the scores it has, recording why.
     *
     * @throws \RuntimeException
     */
    public function decideDespiteDisagreement(Proposal $proposal, User $actor, string $note): Proposal
    {
        if ($proposal->status !== 'under_blind_review' || ! $proposal->review_disagreement_flagged_at) {
            throw new \RuntimeException('This proposal is not waiting on a reviewer-disagreement decision.');
        }

        $proposal->forceFill([
            'review_disagreement_resolved_at' => now(),
            'review_disagreement_resolved_by' => $actor->id,
            'review_disagreement_note' => $note,
        ])->saveQuietly();

        $this->processBlindReviewResult($proposal->fresh(), "{$note} ({$actor->name})");

        return $proposal->fresh();
    }

    private function flagDisagreement(Proposal $proposal, array $disagreement): void
    {
        $firstTime = ! $proposal->review_disagreement_flagged_at;

        $proposal->forceFill([
            'review_disagreement' => $disagreement,
            'review_disagreement_flagged_at' => $proposal->review_disagreement_flagged_at ?? now(),
        ])->saveQuietly();

        if (! $firstTime) {
            return;
        }

        $directorRole = [
            'research' => 'research_officer',
            'community_engagement' => 'community_officer',
            'technology_transfer' => 'technology_officer',
        ][$proposal->category] ?? null;

        $recipients = User::role('central_officer')->where('status', 'active')->get();
        if ($directorRole) {
            $recipients = $recipients->merge(User::role($directorRole)->where('status', 'active')->get());
        }
        $recipients = $recipients->merge(
            User::role('college_officer')->where('status', 'active')->where('college_id', $proposal->college_id)->get()
        )->unique('id');

        $scoreList = collect($disagreement['scores'])->map(fn ($s) => "{$s['label']} {$s['score']}/{$s['max']}")->implode(', ');
        $data = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'message' => "Blind reviewers disagree on {$proposal->tracker_number} ({$scoreList}). "
                .'The automatic decision is on hold — add a reviewer or decide with the current scores.',
        ];

        foreach ($recipients as $recipient) {
            try {
                StoreInAppNotificationJob::dispatchSync($recipient->id, 'review_disagreement', $data);
            } catch (\Throwable $e) {
                Log::error("Review disagreement notification failed: {$e->getMessage()}");
            }

            try {
                SendEmailNotificationJob::dispatchSync($recipient, 'review_disagreement', $data);
            } catch (\Throwable $e) {
                Log::error("Review disagreement email failed: {$e->getMessage()}");
            }
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
        // Same as a validation rejection: the reason is what the PI's rejection
        // notice and the proposal's rejection banner show.
        DB::table('proposals')
            ->where('id', $proposal->id)
            ->update(['rejected_at' => now(), 'rejection_reason' => $reason]);

        return $this->workflowService->transition(
            $proposal->fresh(),
            'fail_blind_review',
            $actor,
            $reason,
            ['manual' => true]
        );
    }
}
