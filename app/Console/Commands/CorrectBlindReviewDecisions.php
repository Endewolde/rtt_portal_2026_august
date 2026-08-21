<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Models\User;
use App\Services\ReviewScoreService;
use App\Services\WorkflowService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CorrectBlindReviewDecisions extends Command
{
    protected $signature = 'reviews:correct-blind-review {--force : Actually apply corrections. Without this flag, only a dry-run report is printed — nothing is changed.}';

    protected $description = 'Recalculate every proposal\'s blind-review pass/fail decision against the CURRENT '
        .'threshold settings and evaluation criteria, and correct proposals that were wrongly PASSED — but only '
        .'while they are still sitting in blind_review_passed (i.e. before an open defence session was scheduled, '
        .'so there is nothing else to unwind). Proposals that already progressed further, or that were wrongly '
        .'REJECTED (a terminal stage), are reported but never auto-corrected — those need a human decision.';

    public function handle(ReviewScoreService $scoreService, WorkflowService $workflowService): int
    {
        $force = (bool) $this->option('force');

        $logs = DB::table('workflow_logs')
            ->whereIn('action', ['pass_blind_review', 'fail_blind_review'])
            ->orderBy('created_at')
            ->get()
            ->groupBy('proposal_id')
            ->map(fn ($group) => $group->last());

        if ($logs->isEmpty()) {
            $this->info('No blind-review decisions found.');

            return self::SUCCESS;
        }

        $systemActor = User::role('super_admin')->first() ?? User::role('central_officer')->first();
        if ($force && ! $systemActor) {
            $this->error('No super_admin or central_officer user found to act as the correcting actor. Aborting.');

            return self::FAILURE;
        }

        $corrected = [];
        $needsReview = [];
        $checked = 0;
        $wouldCorrectCount = 0;

        foreach ($logs as $log) {
            $proposal = Proposal::find($log->proposal_id);
            if (! $proposal) {
                continue;
            }
            $checked++;

            $snapshot = $scoreService->recalculateSnapshot($proposal);
            if ($snapshot['blind_passes'] === null) {
                continue;
            }

            $recordedPass = $log->action === 'pass_blind_review';
            $recalculatedPass = $snapshot['blind_passes'];

            if ($recordedPass === $recalculatedPass) {
                continue;
            }

            $scoreLabel = "{$snapshot['blind']['score']}/{$snapshot['blind']['max']} (min {$snapshot['blind_threshold']})";

            if ($recordedPass && ! $recalculatedPass) {
                if ($proposal->status !== 'blind_review_passed') {
                    $needsReview[] = [
                        $proposal->tracker_number, $proposal->status, 'wrongly passed', $scoreLabel,
                        "already progressed to '{$proposal->status}' — correcting now would affect existing defence assignments/sessions",
                    ];

                    continue;
                }

                if ($force) {
                    try {
                        $workflowService->transition(
                            $proposal,
                            'fail_blind_review',
                            $systemActor,
                            "Corrected automatically: blind review score {$scoreLabel} no longer meets the threshold under "
                                ."current settings (originally passed on {$log->created_at} under a pre-fix calculation).",
                            ['corrected' => true, 'score_label' => $scoreLabel, 'original_decision_at' => $log->created_at]
                        );
                        $corrected[] = [$proposal->tracker_number, 'blind_review_passed → rejected', $scoreLabel];
                    } catch (\Throwable $e) {
                        $needsReview[] = [
                            $proposal->tracker_number, $proposal->status, 'wrongly passed', $scoreLabel,
                            "correction failed: {$e->getMessage()} — run `php artisan db:seed --class=WorkflowStageSeeder` if this is a missing-transition error, then retry",
                        ];
                    }
                } else {
                    $wouldCorrectCount++;
                    $needsReview[] = [
                        $proposal->tracker_number, $proposal->status, 'wrongly passed', $scoreLabel,
                        'would be corrected to rejected — re-run with --force to apply',
                    ];
                }
            } else {
                $needsReview[] = [
                    $proposal->tracker_number, $proposal->status, 'wrongly failed', $scoreLabel,
                    "rejected is a terminal stage — reopening it is a deliberate decision this tool won't make automatically",
                ];
            }
        }

        $this->info("Checked {$checked} proposal(s) with a blind-review decision.");
        $this->newLine();

        if (! empty($corrected)) {
            $this->info(count($corrected).' proposal(s) corrected:');
            $this->table(['Tracker', 'Change', 'Score'], $corrected);
            $this->newLine();
        }

        if (! empty($needsReview)) {
            $this->warn(count($needsReview).' proposal(s) need manual review (not auto-corrected):');
            $this->table(['Tracker', 'Current Status', 'Issue', 'Score', 'Why'], $needsReview);
            $this->newLine();
        }

        if (empty($corrected) && empty($needsReview)) {
            $this->info('Every blind-review decision already matches current thresholds and criteria — nothing to do.');
        }

        if (! $force && $wouldCorrectCount > 0) {
            $this->comment('This was a DRY RUN — nothing was changed. Re-run with --force to apply the corrections listed above.');
        }

        return self::SUCCESS;
    }
}
