<?php

namespace App\Console\Commands;

use App\Services\PersonalDataService;
use Illuminate\Console\Command;

/** Daily: apply the data retention settings (each is off until an admin sets a number of days). */
class ApplyDataRetention extends Command
{
    protected $signature = 'rtt:data-retention {--dry-run : Report what would be removed without changing anything}';

    protected $description = 'Remove stale drafts and read notifications, and deactivate unused accounts, per the retention settings';

    public function handle(PersonalDataService $personalData): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $result = $personalData->applyRetention($dryRun);

        $this->info(($dryRun ? 'Would remove' : 'Removed')." {$result['drafts']} expired draft(s) and {$result['notifications']} old read notification(s); "
            .($dryRun ? 'would deactivate' : 'deactivated')." {$result['accounts']} unused account(s).");

        return self::SUCCESS;
    }
}
