<?php

namespace App\Console\Commands;

use App\Services\ProjectRiskService;
use Illuminate\Console\Command;

class SendRiskDigest extends Command
{
    protected $signature = 'rtt:risk-digest';

    protected $description = 'Weekly: tell monitors about high-risk funded projects in their scope, and each PI about their own.';

    public function handle(ProjectRiskService $risks): int
    {
        $sent = $risks->sendDigest();

        $this->info("{$sent['high']} high-risk project(s); digests sent to {$sent['monitors']} monitor(s) and {$sent['pis']} PI notice(s).");

        return self::SUCCESS;
    }
}
