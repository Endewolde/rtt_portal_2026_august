<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Services\AnonymityCheckService;
use Illuminate\Console\Command;

class CheckProposalAnonymity extends Command
{
    protected $signature = 'proposals:check-anonymity {--status=submitted,validated,under_blind_review : Comma-separated statuses to check}';

    protected $description = 'Run the blind-review anonymity check on existing proposals (it only records the result on each proposal).';

    public function handle(AnonymityCheckService $anonymity): int
    {
        $statuses = array_filter(array_map('trim', explode(',', (string) $this->option('status'))));
        $counts = ['clean' => 0, 'issues' => 0, 'not_checked' => 0];
        $flagged = [];

        Proposal::whereIn('status', $statuses)->orderBy('submitted_at')->each(function (Proposal $proposal) use ($anonymity, &$counts, &$flagged) {
            $result = $anonymity->check($proposal);
            $counts[$result['status']]++;

            if ($result['status'] === AnonymityCheckService::STATUS_ISSUES) {
                $flagged[] = [$proposal->tracker_number, $proposal->status, count($result['findings']), $result['findings'][0]['value'] ?? ''];
            }
        });

        $this->info('Checked '.array_sum($counts)." proposal(s): {$counts['clean']} clean, {$counts['issues']} with possible identity reveals, {$counts['not_checked']} to check by hand.");

        if ($flagged !== []) {
            $this->table(['Tracker', 'Status', 'Findings', 'First match'], $flagged);
        }

        return self::SUCCESS;
    }
}
