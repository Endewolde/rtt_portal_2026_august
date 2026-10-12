<?php

namespace App\Console\Commands;

use App\Services\DefenceDeadlineService;
use Illuminate\Console\Command;

class SweepDefenceDeadlines extends Command
{
    protected $signature = 'rtt:defence-deadlines';

    protected $description = 'Remind open defence reviewers on their last scoring day, and flag defences whose '
        .'score deadline passed with scores still missing (notifying the college officer).';

    public function handle(DefenceDeadlineService $deadlines): int
    {
        $result = $deadlines->sweep();

        $this->info("Sent {$result['reminded']} reminder batch(es), flagged {$result['flagged']} defence(s) past their deadline.");

        return self::SUCCESS;
    }
}
