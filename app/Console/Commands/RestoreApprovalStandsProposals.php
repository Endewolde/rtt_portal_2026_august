<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\WorkflowAction;
use App\Services\ApprovalReportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RestoreApprovalStandsProposals extends Command
{
    protected $signature = 'reports:restore-approval-stands {--force : Actually restore. Without this flag, only a dry-run report is printed — nothing is changed.}';

    protected $description = 'Return proposals left at "validated" by an "approval stands" report decision to the '
        .'stage the report pulled them from (under blind review / blind review passed), then continue from there. '
        .'Only cases with no workflow activity since the report are touched; the rest are reported for a person to decide.';

    public function handle(ApprovalReportService $approvalReports): int
    {
        $force = (bool) $this->option('force');
        $stuck = $approvalReports->stuckApprovalStands();

        if ($stuck->isEmpty()) {
            $this->info('Nothing to restore — no proposal is stuck at Validated after an "approval stands" decision.');

            return self::SUCCESS;
        }

        $missing = collect(ApprovalReportService::RESTORE_ACTIONS)->values()
            ->reject(fn ($action) => WorkflowAction::where('name', $action)->exists());
        if ($force && $missing->isNotEmpty()) {
            $this->error('Workflow steps '.$missing->implode(', ').' are missing. Run `php artisan db:seed --class=WorkflowStageSeeder` first.');

            return self::FAILURE;
        }

        $actor = User::role('super_admin')->first() ?? User::role('central_officer')->first();
        if ($force && ! $actor) {
            $this->error('No super_admin or central_officer user found to act as the restoring actor. Aborting.');

            return self::FAILURE;
        }

        $restored = [];
        $skipped = [];

        foreach ($stuck as $case) {
            $proposal = $case['proposal'];
            $report = $case['report'];

            if (! $case['safe']) {
                $skipped[] = [$proposal->tracker_number, $case['restore_to'], $case['reason']];

                continue;
            }

            if (! $force) {
                $restored[] = [$proposal->tracker_number, "validated → {$case['restore_to']}", 'would be restored — re-run with --force to apply'];

                continue;
            }

            try {
                $restoredTo = DB::transaction(function () use ($approvalReports, $report, $proposal, $actor) {
                    $report->update(['outcome' => 'approval_stands']);

                    return $approvalReports->restoreProposal(
                        $report,
                        $proposal,
                        $actor,
                        'Restored: the mistaken-approval report was resolved with the approval standing on '
                            .($report->reviewed_at?->toDateTimeString() ?? 'an earlier date')
                            .', but the proposal had been left at validated.'
                    );
                });

                $approvalReports->continueFrom($proposal, $restoredTo);
                $restored[] = [$proposal->tracker_number, "validated → {$restoredTo}", 'now at '.$proposal->fresh()->status];
            } catch (\Throwable $e) {
                $skipped[] = [$proposal->tracker_number, $case['restore_to'], "restore failed: {$e->getMessage()}"];
            }
        }

        if ($restored !== []) {
            $this->info(($force ? 'Restored ' : 'Would restore ').count($restored).' proposal(s):');
            $this->table(['Tracker', 'Change', 'Result'], $restored);
            $this->newLine();
        }

        if ($skipped !== []) {
            $this->warn(count($skipped).' proposal(s) need manual review (not changed):');
            $this->table(['Tracker', 'Should return to', 'Why'], $skipped);
            $this->newLine();
        }

        if (! $force && $restored !== []) {
            $this->comment('This was a DRY RUN — nothing was changed. Re-run with --force to apply.');
        }

        return self::SUCCESS;
    }
}
