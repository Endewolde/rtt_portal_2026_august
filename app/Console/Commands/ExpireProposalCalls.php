<?php

namespace App\Console\Commands;

use App\Models\ProposalCall;
use Illuminate\Console\Command;

class ExpireProposalCalls extends Command
{
    protected $signature   = 'rtt:expire-calls';
    protected $description = 'Mark active proposal calls as expired when their end_date has passed';

    public function handle(): void
    {
        $count = ProposalCall::where('status', 'active')
            ->where('end_date', '<', now())
            ->update([
                'status'  => 'expired',
                'is_open' => false,
            ]);

        $this->info("Expired {$count} proposal call(s).");
    }
}
