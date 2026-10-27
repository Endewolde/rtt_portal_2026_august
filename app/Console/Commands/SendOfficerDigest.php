<?php

namespace App\Console\Commands;

use App\Services\OfficerDigestService;
use Illuminate\Console\Command;

class SendOfficerDigest extends Command
{
    protected $signature = 'rtt:officer-digest';

    protected $description = 'Every morning: email each officer what is waiting on them, with a link to each queue.';

    public function handle(OfficerDigestService $digest): int
    {
        $result = $digest->sendAll();

        $this->info("Sent {$result['sent']} officer digest(s); {$result['nothing']} officer(s) had nothing waiting.");

        return self::SUCCESS;
    }
}
