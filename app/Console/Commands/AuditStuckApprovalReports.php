<?php

namespace App\Console\Commands;

use App\Services\ApprovalReportService;
use Illuminate\Console\Command;

class AuditStuckApprovalReports extends Command
{
    protected $signature = 'reports:audit-stuck-approvals';

    protected $description = 'Read-only audit: find proposals left at "validated" after their mistaken-approval '
        .'report was resolved with the approval standing (before resolving restored the proposal). Never mutates anything.';

    public function handle(ApprovalReportService $approvalReports): int
    {
        $stuck = $approvalReports->stuckApprovalStands();

        if ($stuck->isEmpty()) {
            $this->info('No stuck proposals — every "approval stands" report left its proposal where it belongs.');

            return self::SUCCESS;
        }

        $this->warn("{$stuck->count()} proposal(s) are still at Validated although their report was resolved with the approval standing:");
        $this->table(
            ['Tracker', 'Should return to', 'Reported by', 'Resolved by', 'Resolved at', 'Assessment'],
            $stuck->map(fn ($c) => [
                $c['proposal']->tracker_number,
                $c['restore_to'],
                $c['report']->reportedBy?->name ?? '—',
                $c['report']->reviewedBy?->name ?? '—',
                $c['report']->reviewed_at?->toDateTimeString() ?? '—',
                $c['reason'],
            ])->all()
        );

        $safe = $stuck->where('safe', true)->count();
        $this->newLine();
        $this->comment("{$safe} can be restored safely. Preview with `php artisan reports:restore-approval-stands`, then apply with --force.");

        return self::SUCCESS;
    }
}
