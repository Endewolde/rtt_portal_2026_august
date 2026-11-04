<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\RevertedBlindReviewService;
use Illuminate\Console\Command;

class RestoreRevertedBlindReviews extends Command
{
    protected $signature = 'reviews:restore-reverted-blind-review
        {--force : Actually apply the correction. Without this flag, only a dry-run report is printed — nothing is changed.}';

    protected $description = 'Correct proposals sent back to validated although a blind reviewer had already submitted: '
        .'return them to blind review and let the normal decision run on the submitted reviews. Those that would pass '
        .'move on to open defence; those below the pass mark are never touched — an officer decides them.';

    public function handle(RevertedBlindReviewService $service): int
    {
        $force = (bool) $this->option('force');
        $stuck = $service->stuck();

        if ($stuck->isEmpty()) {
            $this->info('No proposals found — nothing to correct.');

            return self::SUCCESS;
        }

        $actor = User::role('central_officer')->first() ?? User::role('super_admin')->first();
        if ($force && ! $actor) {
            $this->error('No central_officer or super_admin user found to act as the correcting actor. Aborting.');

            return self::FAILURE;
        }

        $rows = [];
        $left = 0;

        foreach ($stuck as $proposal) {
            $prediction = $service->predict($proposal);
            $outcome = AuditRevertedBlindReviews::OUTCOMES[$prediction['outcome']] ?? $prediction['outcome'];

            // A rejection is a decision with consequences for the team: an officer makes it.
            if (in_array($prediction['outcome'], ['fail', 'no_reviews'], true)) {
                $rows[] = [$proposal->tracker_number, $prediction['score_label'] ?? '—', 'Left as is: '.$outcome];
                $left++;

                continue;
            }

            if (! $force) {
                $rows[] = [$proposal->tracker_number, $prediction['score_label'] ?? '—', 'Would restore: '.$outcome];

                continue;
            }

            try {
                $restored = $service->restore($proposal, $actor);
                $rows[] = [$proposal->tracker_number, $prediction['score_label'] ?? '—', "Restored — now {$restored->status}"];
            } catch (\Throwable $e) {
                $rows[] = [$proposal->tracker_number, $prediction['score_label'] ?? '—', "Failed: {$e->getMessage()}"];
            }
        }

        $this->table(['Proposal', 'Score', 'Result'], $rows);

        if (! $force) {
            $this->comment('DRY RUN — nothing was changed. Re-run with --force to apply.');
        }
        if ($left > 0) {
            $this->warn("{$left} proposal(s) left as is — an officer should decide them from the proposal page.");
        }

        return self::SUCCESS;
    }
}
