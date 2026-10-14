<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\BudgetMilestone;
use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Regular progress reports between funding and completion: every N months the PI
 * reports what was done, problems, next steps, % complete, spending and milestone
 * status; the last period is the final report. Officers accept or send back.
 */
class ProgressReportService
{
    /** Projects that report — funded and running. */
    public const REPORTING_STATUSES = ['funded', 'midterm_evaluation'];

    /** Days after a period ends that its report is due. */
    private const GRACE_DAYS = 14;

    private const DUE_SOON_DAYS = 7;

    private const DIRECTOR_ROLES = [
        'research' => 'research_officer',
        'community_engagement' => 'community_officer',
        'technology_transfer' => 'technology_officer',
    ];

    /**
     * Create (or re-date) the report periods for a funded project. Periods already
     * submitted or reviewed are never touched.
     *
     * @return Collection<int, ProgressReport>
     */
    public function syncSchedule(Proposal $proposal): Collection
    {
        $start = $this->fundingDate($proposal)->copy()->startOfDay();
        $interval = $this->intervalMonths();
        $duration = max(1, (int) ($proposal->duration_months ?: 12));
        $projectEnd = $start->copy()->addMonthsNoOverflow($duration)->subDay();
        $periods = (int) ceil($duration / $interval);

        for ($n = 1; $n <= $periods; $n++) {
            $periodStart = $start->copy()->addMonthsNoOverflow(($n - 1) * $interval);
            $periodEnd = $n === $periods ? $projectEnd->copy() : $start->copy()->addMonthsNoOverflow($n * $interval)->subDay();

            $report = ProgressReport::firstOrNew(['proposal_id' => $proposal->id, 'period_number' => $n]);
            if ($report->exists && ! $report->isOpenForSubmission()) {
                continue;
            }

            $report->fill([
                'period_start' => $periodStart->toDateString(),
                'period_end' => $periodEnd->toDateString(),
                'due_date' => $periodEnd->copy()->addDays(self::GRACE_DAYS)->toDateString(),
                'is_final' => $n === $periods,
                'status' => $report->status ?? ProgressReport::STATUS_DUE,
            ])->save();
        }

        // A shortened duration leaves trailing periods nobody has to fill in.
        ProgressReport::where('proposal_id', $proposal->id)
            ->where('period_number', '>', $periods)
            ->where('status', ProgressReport::STATUS_DUE)
            ->delete();

        return ProgressReport::where('proposal_id', $proposal->id)->orderBy('period_number')->get();
    }

    /**
     * @param  array{summary: string, achievements?: string|null, challenges?: string|null, next_steps?: string|null, percent_complete: int, budget_spent?: float|null, milestone_updates?: array<int, array{milestone_id: string, status: string, note?: string|null}>}  $data
     *
     * @throws \RuntimeException
     */
    public function submit(ProgressReport $report, User $user, array $data, ?UploadedFile $attachment): ProgressReport
    {
        $proposal = $report->proposal;

        if (! $this->isTeamMember($proposal, $user)) {
            throw new \RuntimeException('Only the PI or a team member can submit this report.');
        }
        if (! $report->isOpenForSubmission()) {
            throw new \RuntimeException('This report has already been submitted.');
        }
        if ($report->period_start->isFuture()) {
            throw new \RuntimeException('This reporting period has not started yet.');
        }

        $milestones = $this->validMilestoneUpdates($proposal, $data['milestone_updates'] ?? []);

        DB::transaction(function () use ($report, $user, $data, $attachment, $milestones) {
            $fields = [
                'summary' => $data['summary'],
                'achievements' => $data['achievements'] ?? null,
                'challenges' => $data['challenges'] ?? null,
                'next_steps' => $data['next_steps'] ?? null,
                'percent_complete' => $data['percent_complete'],
                'budget_spent' => $data['budget_spent'] ?? null,
                'milestone_updates' => $milestones,
                'status' => ProgressReport::STATUS_SUBMITTED,
                'submitted_by' => $user->id,
                'submitted_at' => now(),
            ];

            if ($attachment) {
                $fields['attachment_path'] = $attachment->store("proposals/{$report->proposal_id}/progress-reports", 'private');
                $fields['attachment_name'] = $attachment->getClientOriginalName();
            }

            $report->update($fields);

            // Keep the budget milestones themselves in step with what the PI reported.
            foreach ($milestones as $update) {
                BudgetMilestone::where('id', $update['milestone_id'])->update([
                    'status' => $update['status'],
                    'completed_at' => $update['status'] === 'completed' ? now() : null,
                ]);
            }
        });

        $label = $report->is_final ? 'final report' : "progress report #{$report->period_number}";
        $this->notifyMany($this->officersFor($proposal), 'progress_report_submitted', $report, "{$proposal->tracker_number}: the {$label} was submitted and is waiting for your review.");

        return $report->fresh();
    }

    /**
     * @throws \RuntimeException
     */
    public function review(ProgressReport $report, User $actor, string $decision, string $notes): ProgressReport
    {
        if ($report->status !== ProgressReport::STATUS_SUBMITTED) {
            throw new \RuntimeException('Only a submitted report can be reviewed.');
        }

        $report->update([
            'status' => $decision === 'accepted' ? ProgressReport::STATUS_ACCEPTED : ProgressReport::STATUS_REVISION,
            'reviewed_by' => $actor->id,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ]);

        $proposal = $report->proposal;
        $label = $report->is_final ? 'final report' : "progress report #{$report->period_number}";
        $pi = User::find($proposal->pi_user_id);
        if ($pi) {
            $this->notifyMany(collect([$pi]), 'progress_report_reviewed', $report, $decision === 'accepted'
                ? "Your {$label} for {$proposal->tracker_number} was accepted. {$notes}"
                : "Your {$label} for {$proposal->tracker_number} needs revision: {$notes}");
        }

        return $report->fresh();
    }

    /**
     * Daily: keep schedules current and remind PIs of reports due soon or overdue.
     *
     * @return array{synced: int, due_soon: int, overdue: int}
     */
    public function sweep(): array
    {
        $synced = 0;
        Proposal::whereIn('status', self::REPORTING_STATUSES)->each(function (Proposal $proposal) use (&$synced) {
            $this->syncSchedule($proposal);
            $synced++;
        });

        $dueSoon = 0;
        $overdue = 0;

        ProgressReport::with('proposal')
            ->whereIn('status', [ProgressReport::STATUS_DUE, ProgressReport::STATUS_REVISION])
            ->whereHas('proposal', fn ($q) => $q->whereIn('status', self::REPORTING_STATUSES))
            ->get()
            ->each(function (ProgressReport $report) use (&$dueSoon, &$overdue) {
                $pi = User::find($report->proposal->pi_user_id);
                if (! $pi) {
                    return;
                }
                $label = $report->is_final ? 'final report' : "progress report #{$report->period_number}";
                $tracker = $report->proposal->tracker_number;

                if ($report->isOverdue() && ! $report->overdue_reminder_sent_at) {
                    $this->notifyMany(collect([$pi]), 'progress_report_overdue', $report,
                        "Your {$label} for {$tracker} was due on {$report->due_date->format('M j, Y')} and is now overdue.");
                    $report->update(['overdue_reminder_sent_at' => now()]);
                    $overdue++;
                } elseif (! $report->isOverdue() && ! $report->due_reminder_sent_at
                    && $report->period_end->isPast()
                    && now()->diffInDays($report->due_date, false) <= self::DUE_SOON_DAYS) {
                    $this->notifyMany(collect([$pi]), 'progress_report_due', $report,
                        "Your {$label} for {$tracker} is due by {$report->due_date->format('M j, Y')}.");
                    $report->update(['due_reminder_sent_at' => now()]);
                    $dueSoon++;
                }
            });

        return ['synced' => $synced, 'due_soon' => $dueSoon, 'overdue' => $overdue];
    }

    public function isTeamMember(Proposal $proposal, User $user): bool
    {
        return $proposal->pi_user_id === $user->id
            || $proposal->activeMembers()->where('user_id', $user->id)->exists();
    }

    /** Who reviews this project's reports: its college officer, its category director, the central office. */
    public function canReview(Proposal $proposal, User $user): bool
    {
        if ($user->hasAnyRole(['super_admin', 'admin', 'central_officer'])) {
            return true;
        }
        if ($user->hasRole('college_officer') && $user->college_id === $proposal->college_id) {
            return true;
        }
        $director = self::DIRECTOR_ROLES[$proposal->category] ?? null;

        return $director !== null && $user->hasRole($director);
    }

    private function fundingDate(Proposal $proposal): Carbon
    {
        $awarded = $proposal->award?->approved_at;
        if ($awarded) {
            return Carbon::parse($awarded);
        }

        $fundedLog = DB::table('workflow_logs')->where('proposal_id', $proposal->id)->where('to_stage', 'funded')->orderBy('created_at')->value('created_at');

        return Carbon::parse($fundedLog ?? $proposal->status_entered_at ?? now());
    }

    private function intervalMonths(): int
    {
        $value = (int) (DB::table('app_settings')->where('key', 'progress_report_interval_months')->value('value') ?? 3);

        return max(1, min(12, $value));
    }

    /**
     * Only this project's milestones, with a known status.
     *
     * @return list<array{milestone_id: string, title: string, status: string, note: string|null}>
     */
    private function validMilestoneUpdates(Proposal $proposal, array $updates): array
    {
        $milestones = BudgetMilestone::where('proposal_id', $proposal->id)->get(['id', 'title'])->keyBy('id');

        return collect($updates)
            ->filter(fn ($u) => isset($u['milestone_id'], $u['status'])
                && $milestones->has($u['milestone_id'])
                && in_array($u['status'], ['pending', 'in_progress', 'completed'], true))
            ->map(fn ($u) => [
                'milestone_id' => $u['milestone_id'],
                'title' => $milestones[$u['milestone_id']]->title,
                'status' => $u['status'],
                'note' => isset($u['note']) ? mb_substr((string) $u['note'], 0, 500) : null,
            ])
            ->values()
            ->all();
    }

    /** @return Collection<int, User> */
    private function officersFor(Proposal $proposal): Collection
    {
        $officers = User::role('college_officer')->where('status', 'active')->where('college_id', $proposal->college_id)->get();
        $director = self::DIRECTOR_ROLES[$proposal->category] ?? null;
        if ($director) {
            $officers = $officers->merge(User::role($director)->where('status', 'active')->get());
        }

        return $officers->unique('id')->values();
    }

    private function notifyMany(Collection $users, string $event, ProgressReport $report, string $message): void
    {
        $proposal = $report->proposal;
        $data = [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'report_id' => $report->id,
            'message' => $message,
        ];

        foreach ($users as $user) {
            try {
                StoreInAppNotificationJob::dispatchSync($user->id, $event, $data);
            } catch (\Throwable $e) {
                Log::error("Progress report notification ({$event}) failed: {$e->getMessage()}");
            }

            try {
                SendEmailNotificationJob::dispatchSync($user, $event, $data);
            } catch (\Throwable $e) {
                Log::error("Progress report email ({$event}) failed: {$e->getMessage()}");
            }
        }
    }
}
