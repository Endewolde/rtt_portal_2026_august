<?php

namespace App\Console\Commands;

use App\Exceptions\WorkflowGuardException;
use App\Jobs\ArchiveProposalJob;
use App\Models\Proposal;
use Illuminate\Console\Command;

/**
 * Daily: archive projects completed at least 30 days ago. Replaces a delayed queue job that
 * never ran on servers without a queue worker.
 */
class ArchiveCompletedProposals extends Command
{
    private const DAYS_AFTER_COMPLETION = 30;

    protected $signature = 'proposals:archive-completed';

    protected $description = 'Archive proposals completed at least 30 days ago';

    public function handle(): int
    {
        $archived = 0;
        $waiting = 0;

        Proposal::where('status', 'completed')
            ->where('status_entered_at', '<=', now()->subDays(self::DAYS_AFTER_COMPLETION))
            ->get(['id', 'tracker_number'])
            ->each(function (Proposal $proposal) use (&$archived, &$waiting) {
                try {
                    app()->call([new ArchiveProposalJob($proposal->id), 'handle']);
                    $archived++;
                } catch (WorkflowGuardException $e) {
                    // Not ready yet (no research output, funds unsettled) — try again tomorrow.
                    $this->line("  {$proposal->tracker_number}: {$e->getMessage()}");
                    $waiting++;
                }
            });

        $this->info("Archived {$archived} proposal(s); {$waiting} not ready yet.");

        return self::SUCCESS;
    }
}
