<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Models\ProposalVersion;
use App\Services\ProposalVersionService;
use Illuminate\Console\Command;

/**
 * One-off: proposals submitted before versions were kept get their current state recorded
 * as version 1, so a later resubmission has something to compare against. Drafts are
 * skipped — a returned draft may already contain unsubmitted corrections.
 */
class BackfillProposalVersions extends Command
{
    protected $signature = 'proposals:backfill-versions';

    protected $description = 'Record the current state of already-submitted proposals as their first version';

    public function handle(ProposalVersionService $versions): int
    {
        $created = 0;

        Proposal::where('status', '!=', 'draft')
            ->whereNotIn('id', ProposalVersion::select('proposal_id'))
            ->each(function (Proposal $proposal) use ($versions, &$created) {
                $version = $versions->capture($proposal, null);
                $version->update(['submitted_at' => $proposal->submitted_at ?? $proposal->created_at]);
                $created++;
            });

        $this->info("Recorded a first version for {$created} proposal".($created === 1 ? '' : 's').'.');

        return self::SUCCESS;
    }
}
