<?php

namespace App\Console\Commands;

use App\Jobs\SendEmailNotificationJob;
use App\Models\AppSetting;
use App\Models\Proposal;
use App\Models\ProposalCall;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

#[Signature('academic-year:transition {new_year : The new academic year (e.g. 2025/26)} {--dry-run : Preview what would happen without making changes}')]
#[Description('Close the current academic year: closes active proposal calls and notifies PIs of open proposals.')]
class AcademicYearTransition extends Command
{
    public function handle(): int
    {
        $newYear = $this->argument('new_year');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('[DRY RUN] No changes will be made.');
        }

        $this->info("Starting academic year transition → {$newYear}");

        // 1. Close all open proposal calls
        $openCalls = ProposalCall::where('status', 'active')->get();
        $this->info("Found {$openCalls->count()} open proposal call(s) to close.");

        if (! $dryRun) {
            foreach ($openCalls as $call) {
                $call->update(['status' => 'closed', 'is_open' => false]);
                $this->line("  Closed: {$call->title}");
            }
        } else {
            foreach ($openCalls as $call) {
                $this->line("  [DRY] Would close: {$call->title}");
            }
        }

        // 2. Notify PIs of proposals that are still open (non-terminal, non-draft)
        $openStatuses = ['submitted', 'validated', 'under_blind_review', 'under_open_defence', 'accepted', 'funded', 'midterm_evaluation', 'completed'];
        $openProposals = Proposal::with('pi')
            ->whereIn('status', $openStatuses)
            ->whereNull('deleted_at')
            ->get();

        $this->info("Found {$openProposals->count()} open proposal(s) whose PIs will be notified.");

        $notified = 0;
        foreach ($openProposals as $proposal) {
            if (! $proposal->pi?->email) {
                continue;
            }

            if (! $dryRun) {
                try {
                    SendEmailNotificationJob::dispatchSync($proposal->pi, 'academic_year_transition', [
                        'tracker_number' => $proposal->tracker_number,
                        'title' => $proposal->title,
                        'status' => $proposal->status,
                        'new_year' => $newYear,
                    ]);
                    $notified++;
                } catch (\Exception $e) {
                    Log::error("Transition notify failed for {$proposal->tracker_number}: {$e->getMessage()}");
                    $this->warn("  Failed to notify PI for {$proposal->tracker_number}: {$e->getMessage()}");
                }
            } else {
                $this->line("  [DRY] Would notify {$proposal->pi->email} for {$proposal->tracker_number} ({$proposal->status})");
                $notified++;
            }
        }

        // 3. Update the default academic year setting
        if (! $dryRun) {
            AppSetting::updateOrCreate(
                ['key' => 'current_academic_year'],
                ['value' => $newYear]
            );
            $this->info("Updated current_academic_year setting to '{$newYear}'.");
        } else {
            $this->line("[DRY] Would set current_academic_year = '{$newYear}'");
        }

        $this->info("Transition complete. Closed {$openCalls->count()} call(s), notified {$notified} PI(s).");

        return self::SUCCESS;
    }
}
