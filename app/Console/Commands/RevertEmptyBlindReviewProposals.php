<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Models\User;
use App\Services\WorkflowService;
use Illuminate\Console\Command;

class RevertEmptyBlindReviewProposals extends Command
{
    protected $signature = 'reviews:revert-empty-blind-review {--force : Actually apply the revert. Without this flag, only a dry-run report is printed — nothing is changed.}';

    protected $description = 'One-off data correction: find proposals stuck at under_blind_review with zero active '
        .'reviewers — from before ReviewController::removeReviewer() started auto-reverting the last removal — and '
        .'transition them back to validated so they reappear in the Assign Reviewers queue. Going forward this '
        .'situation self-corrects; this command only needs to run once per environment to clean up pre-existing data.';

    public function handle(WorkflowService $workflowService): int
    {
        $force = (bool) $this->option('force');

        $stuck = Proposal::where('status', 'under_blind_review')
            ->whereDoesntHave('reviewAssignments', fn ($q) => $q->whereIn('status', ['pending', 'accepted', 'in_progress']))
            ->get();

        if ($stuck->isEmpty()) {
            $this->info('No stuck proposals found — nothing to do.');

            return self::SUCCESS;
        }

        $systemActor = User::role('super_admin')->first() ?? User::role('central_officer')->first();
        if ($force && ! $systemActor) {
            $this->error('No super_admin or central_officer user found to act as the correcting actor. Aborting.');

            return self::FAILURE;
        }

        $rows = [];

        foreach ($stuck as $proposal) {
            if (! $force) {
                $rows[] = [$proposal->tracker_number, 'would revert to validated'];

                continue;
            }

            try {
                $workflowService->transition(
                    $proposal,
                    'unassign_reviewers',
                    $systemActor,
                    'Reverted to validated — proposal had zero reviewers (pre-existing data, corrected retroactively).'
                );
                $rows[] = [$proposal->tracker_number, 'reverted to validated'];
            } catch (\Throwable $e) {
                $rows[] = [$proposal->tracker_number, "failed: {$e->getMessage()}"];
            }
        }

        $this->table(['Tracker', 'Result'], $rows);

        if (! $force) {
            $this->comment(count($stuck).' proposal(s) found. This was a DRY RUN — nothing was changed. Re-run with --force to apply.');
        } else {
            $this->info(count($stuck).' proposal(s) processed.');
        }

        return self::SUCCESS;
    }
}
