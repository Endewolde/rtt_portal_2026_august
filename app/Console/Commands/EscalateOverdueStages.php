<?php

namespace App\Console\Commands;

use App\Services\TurnaroundService;
use Illuminate\Console\Command;

class EscalateOverdueStages extends Command
{
    protected $signature = 'rtt:stage-escalations';

    protected $description = 'Daily: remind whoever must act on proposals past their stage target, and escalate those at twice the target to the central office.';

    public function handle(TurnaroundService $turnaround): int
    {
        $result = $turnaround->sweepOverdue();

        $this->info("Reminded on {$result['reminded']} overdue proposal(s); escalated {$result['escalated']}.");

        return self::SUCCESS;
    }
}
