<?php

namespace App\Services;

use App\Exceptions\InvalidScoreException;
use App\Exceptions\ReviewAlreadySubmittedException;
use App\Models\DefenceSession;
use App\Models\EvaluationQuestion;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use Carbon\Carbon;
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
        User $_reviewer
    ): ReviewAssignment {
        if ($assignment->status === 'submitted') {
            throw new ReviewAlreadySubmittedException('This review has already been submitted.');
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

        DB::transaction(function () use ($assignment, $answers) {
            foreach ($answers as $answer) {
                ReviewScore::updateOrCreate(
                    [
                        'review_assignment_id'   => $assignment->id,
                        'evaluation_question_id' => $answer['question_id'],
                    ],
                    [
                        'score'          => $answer['score'],
                        'comment'        => $answer['comment'] ?? null,
                        'recommendation' => $answer['recommendation'] ?? null,
                    ]
                );
            }

            $assignment->update([
                'status'       => 'submitted',
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
                'error'         => $e->getMessage(),
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
        $today         = Carbon::today();

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
        $scores = ReviewScore::where('review_assignment_id', $assignment->id)
            ->with('evaluationQuestion.category')
            ->get();

        if ($scores->isEmpty()) {
            return 0.0;
        }

        $byCategory = $scores->groupBy(fn ($s) => $s->evaluationQuestion?->evaluation_category_id ?? 'none');

        $allHaveWeight = $byCategory->every(
            fn ($catScores) => ($catScores->first()->evaluationQuestion?->category?->weight ?? 0) > 0
        );

        if ($allHaveWeight) {
            $weightedSum = 0.0;
            $totalWeight = 0.0;

            foreach ($byCategory as $catScores) {
                $category    = $catScores->first()->evaluationQuestion->category;
                $catEarned   = $catScores->sum('score');
                $catMax      = $catScores->sum(fn ($s) => $s->evaluationQuestion->max_score);
                $catPct      = $catMax > 0 ? $catEarned / $catMax : 0.0;

                $weightedSum += $catPct * $category->weight;
                $totalWeight += $category->weight;
            }

            return $totalWeight > 0 ? round(($weightedSum / $totalWeight) * 100, 2) : 0.0;
        }

        $totalScore    = $scores->sum('score');
        $totalMaxScore = $scores->sum(fn ($s) => $s->evaluationQuestion->max_score);

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
        $scores = ReviewScore::where('review_assignment_id', $assignment->id)
            ->with('evaluationQuestion.category')
            ->get();

        if ($scores->isEmpty()) {
            return ['score' => 0.0, 'max' => 0.0];
        }

        $byCategory    = $scores->groupBy(fn ($s) => $s->evaluationQuestion?->evaluation_category_id ?? 'none');
        $allHaveWeight = $byCategory->every(
            fn ($cs) => ($cs->first()->evaluationQuestion?->category?->weight ?? 0) > 0
        );

        if ($allHaveWeight) {
            $weightedSum = 0.0;
            $totalWeight = 0.0;

            foreach ($byCategory as $catScores) {
                $category  = $catScores->first()->evaluationQuestion->category;
                $catEarned = $catScores->sum('score');
                $catMax    = $catScores->sum(fn ($s) => $s->evaluationQuestion->max_score);
                $catPct    = $catMax > 0 ? $catEarned / $catMax : 0.0;

                $weightedSum += $catPct * $category->weight;
                $totalWeight += $category->weight;
            }

            return ['score' => round($weightedSum, 2), 'max' => $totalWeight];
        }

        $totalScore = $scores->sum('score');
        $totalMax   = $scores->sum(fn ($s) => $s->evaluationQuestion->max_score);

        return ['score' => (float) $totalScore, 'max' => (float) $totalMax];
    }

    /**
     * When all open-defence scores are in, calculate the combined (blind + defence)
     * score and automatically transition the proposal to accepted or rejected.
     * Mirrors processBlindReviewResult — no manual trigger needed.
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

        $blindAssignments = ReviewAssignment::where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'blind_review%'))
            ->where('status', 'submitted')
            ->get();

        $blindScore   = $blindAssignments->isNotEmpty()
            ? $blindAssignments->map(fn ($a) => $this->calculateScore($a))->avg()
            : 0;
        $defenceScore = $defenceAssignments->map(fn ($a) => $this->calculateScore($a))->avg();
        $combined     = $blindScore + $defenceScore;

        $threshold = (float) (DB::table('threshold_settings')
            ->where('key', 'combined_threshold')
            ->value('value') ?? 120);

        $systemActor = User::role('central_officer')->first()
            ?? User::role('super_admin')->first();

        if (! $systemActor) {
            Log::error('processOpenDefenceResultIfComplete: no system actor found (central_officer or super_admin).');

            return;
        }

        // Build "X/max" display labels for the note
        $blindDisplayInfos   = ReviewAssignment::where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'blind_review%'))
            ->where('status', 'submitted')
            ->get()
            ->map(fn ($a) => $this->calculateWeightedDisplay($a));

        $defenceDisplayInfos = $defenceAssignments->map(fn ($a) => $this->calculateWeightedDisplay($a));

        $blindRaw    = $blindDisplayInfos->isNotEmpty() ? round($blindDisplayInfos->avg('score'), 2) : 0;
        $blindMax    = $blindDisplayInfos->isNotEmpty() ? $blindDisplayInfos->first()['max'] : 0;
        $defenceRaw  = round($defenceDisplayInfos->avg('score'), 2);
        $defenceMax  = $defenceDisplayInfos->first()['max'] ?? 0;

        $blindLabel   = $blindMax > 0   ? "{$blindRaw}/{$blindMax}"   : "{$blindScore}%";
        $defenceLabel = $defenceMax > 0 ? "{$defenceRaw}/{$defenceMax}" : "{$defenceScore}%";

        $action  = $combined >= $threshold ? 'pass_defence' : 'fail_defence';
        $outcome = $combined >= $threshold ? 'passed' : 'failed';

        DB::transaction(function () use ($proposal, $combined, $action, $outcome, $systemActor, $blindScore, $defenceScore, $threshold, $blindLabel, $defenceLabel) {
            DefenceSession::where('proposal_id', $proposal->id)
                ->where('status', 'scheduled')
                ->latest()
                ->update(['final_score' => $combined, 'status' => 'completed']);

            $this->workflowService->transition(
                $proposal,
                $action,
                $systemActor,
                "Defence {$outcome} automatically. Blind: {$blindLabel}, Defence: {$defenceLabel}. Combined threshold: {$threshold}.",
                ['blind_score' => $blindScore, 'defence_score' => $defenceScore, 'combined' => $combined]
            );
        });
    }

    /**
     * Check if all reviewers submitted. If yes, calculate average and transition proposal.
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

        $averageScore = $assignments->map(fn ($a) => $this->calculateScore($a))->avg();

        $threshold = (float) (DB::table('threshold_settings')
            ->where('key', 'blind_threshold')
            ->value('value') ?? 60);

        // Build a human-readable "X/max" label using raw weighted scores
        $displayInfos = $assignments->map(fn ($a) => $this->calculateWeightedDisplay($a));
        $rawAvg       = round($displayInfos->avg('score'), 2);
        $rawMax       = $displayInfos->first()['max'];
        $scoreLabel   = $rawMax > 0 ? "{$rawAvg}/{$rawMax}" : "{$averageScore}%";

        $systemActor = User::role('central_officer')->first()
            ?? User::role('super_admin')->first();

        if ($averageScore >= $threshold) {
            $this->workflowService->transition(
                $proposal,
                'pass_blind_review',
                $systemActor,
                "Blind review passed. Average score: {$scoreLabel}. Threshold: {$threshold}%.",
                ['average_score' => $averageScore, 'score_label' => $scoreLabel, 'threshold' => $threshold]
            );
        } else {
            $this->workflowService->transition(
                $proposal,
                'fail_blind_review',
                $systemActor,
                "Blind review failed. Average score: {$scoreLabel}. Threshold: {$threshold}%.",
                ['average_score' => $averageScore, 'score_label' => $scoreLabel, 'threshold' => $threshold]
            );
        }
    }
}
