<?php

namespace App\Console\Commands;

use App\Models\DefenceSession;
use App\Services\DefenceAttendanceService;
use App\Support\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Defences recorded as "team did not appear" before no-shows removed the panel
 * kept their assignments (as voided or cancelled) and any scores given. This
 * removes them the same way a no-show does now. Only proposals that were
 * rejected for that no-show and never moved on are touched.
 */
class RemoveNoShowDefencePanels extends Command
{
    protected $signature = 'defence:remove-no-show-panels {--force : Actually remove them. Without this flag, only a dry-run report is printed — nothing is changed.}';

    protected $description = 'Remove the open-defence panel assignments and scores left on proposals whose team did not appear for their defence.';

    public function handle(DefenceAttendanceService $attendance): int
    {
        $force = (bool) $this->option('force');
        $rows = [];
        $skipped = [];

        DefenceSession::with('proposal')->where('attendance', DefenceAttendanceService::ABSENT)->get()
            ->each(function (DefenceSession $session) use ($attendance, $force, &$rows, &$skipped) {
                $proposal = $session->proposal;
                if (! $proposal) {
                    return;
                }

                $assignments = $attendance->defenceAssignments($proposal);
                if ($assignments->isEmpty()) {
                    return;
                }

                // A proposal that is no longer rejected was reopened by someone, so its panel may be current.
                if ($proposal->status !== 'rejected') {
                    $skipped[] = [$proposal->tracker_number, $proposal->status, $assignments->count()];

                    return;
                }

                $rows[] = [
                    $proposal->tracker_number,
                    $assignments->count(),
                    $assignments->sum(fn ($a) => $a->scores->count()),
                    $assignments->pluck('reviewer.name')->filter()->implode(', '),
                ];

                if ($force) {
                    DB::transaction(fn () => $attendance->removeAssignments($assignments));
                    AuditLogger::log('defence.no_show_panel_removed', DefenceSession::class, $session->id, null, null, [
                        'proposal_id' => $proposal->id,
                        'removed_assignments' => $attendance->snapshot($assignments),
                    ]);
                }
            });

        if ($rows === []) {
            $this->info('Nothing to remove: no no-show defence still has panel assignments.');
        } else {
            $this->table(['Proposal', 'Assignments', 'Scores', 'Reviewers'], $rows);
            $this->line($force
                ? '<info>Removed.</info> A copy of everything removed is in the audit log (defence.no_show_panel_removed).'
                : '<comment>Dry run — nothing changed. Run again with --force to remove these.</comment>');
        }

        if ($skipped !== []) {
            $this->newLine();
            $this->warn('Left alone — these proposals are no longer rejected, so check them by hand:');
            $this->table(['Proposal', 'Status now', 'Assignments'], $skipped);
        }

        return self::SUCCESS;
    }
}
