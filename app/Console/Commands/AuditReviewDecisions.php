<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Services\ReviewScoreService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AuditReviewDecisions extends Command
{
    protected $signature = 'reviews:audit-decisions';

    protected $description = 'Read-only audit: find proposals whose recorded blind-review/open-defence pass-fail '
        .'decision no longer matches what the CURRENT threshold settings and evaluation criteria would decide '
        .'(e.g. proposals decided before the raw-points threshold fix). Never mutates anything.';

    public function handle(ReviewScoreService $scoreService): int
    {
        $logs = DB::table('workflow_logs')
            ->whereIn('action', ['pass_blind_review', 'fail_blind_review', 'pass_defence', 'fail_defence'])
            ->orderBy('created_at')
            ->get();

        if ($logs->isEmpty()) {
            $this->info('No blind-review/open-defence decisions found.');

            return self::SUCCESS;
        }

        // Keep only the most recent decision of each phase per proposal.
        $latest = $logs->groupBy(fn ($l) => $l->proposal_id.'|'.(str_contains($l->action, 'blind') ? 'blind' : 'defence'))
            ->map(fn ($group) => $group->last());

        $mismatches = [];
        $checked = 0;

        foreach ($latest as $log) {
            $proposal = Proposal::find($log->proposal_id);
            if (! $proposal) {
                continue;
            }
            $checked++;

            $snapshot = $scoreService->recalculateSnapshot($proposal);
            $isBlind = str_contains($log->action, 'blind');

            if ($isBlind) {
                if ($snapshot['blind_passes'] === null) {
                    continue;
                }
                $recordedPass = $log->action === 'pass_blind_review';
                $recalculatedPass = $snapshot['blind_passes'];
                $scoreLabel = "{$snapshot['blind']['score']}/{$snapshot['blind']['max']} (min {$snapshot['blind_threshold']})";
            } else {
                if ($snapshot['combined_passes'] === null) {
                    continue;
                }
                $recordedPass = $log->action === 'pass_defence';
                $recalculatedPass = $snapshot['combined_passes'];
                $scoreLabel = "{$snapshot['combined']}/{$snapshot['combined_max']} (min {$snapshot['combined_threshold']})";
            }

            if ($recordedPass !== $recalculatedPass) {
                $mismatches[] = [
                    $proposal->tracker_number,
                    $proposal->status,
                    $isBlind ? 'blind_review' : 'open_defence',
                    $recordedPass ? 'passed' : 'failed',
                    $recalculatedPass ? 'would pass' : 'would fail',
                    $scoreLabel,
                    $log->created_at,
                ];
            }
        }

        $this->info("Checked {$checked} decision(s) across {$latest->count()} proposal-phase combination(s).");
        $this->newLine();

        if (empty($mismatches)) {
            $this->info('No mismatches found — every recorded decision still matches current thresholds and criteria.');

            return self::SUCCESS;
        }

        $this->warn(count($mismatches).' mismatch(es) found:');
        $this->newLine();

        $this->table(
            ['Tracker', 'Current Status', 'Phase', 'Recorded', 'Recalculated Now', 'Score', 'Decided At'],
            $mismatches
        );

        $this->newLine();
        $this->comment('This command is read-only — nothing was changed. Review each case before deciding how to remediate.');

        return self::SUCCESS;
    }
}
