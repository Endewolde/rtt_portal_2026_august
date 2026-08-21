<?php

namespace App\Services;

use App\Exceptions\ReminderCooldownException;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\ReviewReminder;
use App\Models\ThresholdSetting;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Single source of truth for review-deadline reminders: both the daily scheduled
 * command and the admin dashboard's manual "Remind" button call sendReminder(),
 * so what was sent (dashboard reminder history) and what triggers a send (the
 * schedule) can never drift apart.
 */
class ReviewReminderService
{
    /** Assignment statuses still awaiting reviewer action — matches ReviewAssignmentService::ensureWithinWorkloadCap(). */
    public const ACTIVE_STATUSES = ['pending', 'accepted', 'in_progress'];

    /** Reminder type => days before due_date. */
    private const BEFORE_TIERS = [
        '7_days_before' => 7,
        '3_days_before' => 3,
        '1_day_before' => 1,
        'due_today' => 0,
    ];

    /**
     * Send (and log) one reminder for one assignment. Used by both the scheduler
     * and the dashboard's manual "Remind" action.
     *
     * @throws ReminderCooldownException if a manual reminder was already sent in the last 5 minutes.
     */
    public function sendReminder(ReviewAssignment $assignment, string $type, ?User $actor = null): void
    {
        $reviewer = $assignment->reviewer;
        if (! $reviewer) {
            return;
        }

        if ($type === 'manual') {
            $recentlySent = ReviewReminder::where('review_assignment_id', $assignment->id)
                ->where('sent_at', '>=', now()->subMinutes(5))
                ->exists();

            if ($recentlySent) {
                throw new ReminderCooldownException;
            }
        }

        $today = now()->startOfDay();
        $due = $assignment->due_date?->copy()->startOfDay();
        $daysRemaining = $due ? (int) $today->diffInDays($due, false) : 0;

        // Fetched fresh by id rather than trusting $assignment->proposal /
        // ->evaluationType — a caller may have already eager-loaded either relation
        // with a narrower column set (e.g. just id/college_id for a scope check),
        // and Eloquent won't lazily re-fetch a relation that's already "loaded",
        // which previously sent reminders with a blank proposal title/tracker number.
        $proposal = Proposal::find($assignment->proposal_id, ['id', 'tracker_number', 'title']);
        $evaluationType = EvaluationType::find($assignment->evaluation_type_id, ['id', 'name', 'label']);

        $data = [
            'reviewer_name' => $reviewer->name,
            'tracker_number' => $proposal?->tracker_number ?? '—',
            'proposal_title' => $proposal?->title ?? '—',
            'review_type' => $evaluationType?->label ?? $evaluationType?->name ?? '—',
            'days_remaining' => $daysRemaining,
            'due_date' => $assignment->due_date?->format('d M Y') ?? '—',
            'review_url' => config('app.url').'/reviews/'.$assignment->id.'/score',
        ];

        SendEmailNotificationJob::dispatchSync($reviewer, 'review_deadline_reminder', $data);
        StoreInAppNotificationJob::dispatchSync($reviewer->id, 'review_deadline_reminder', $data);

        ReviewReminder::create([
            'review_assignment_id' => $assignment->id,
            'type' => $type,
            'sent_at' => now(),
            'sent_by' => $actor?->id,
        ]);
    }

    /**
     * Run the full automated schedule: 7/3/1 days before, on the due date, and every
     * N days after becoming overdue (N configurable via the overdue_reminder_interval_days
     * threshold setting). Idempotent against being run more than once on the same day.
     *
     * @return array{sent: int, skipped: int, errors: int}
     */
    public function runScheduledReminders(): array
    {
        $summary = ['sent' => 0, 'skipped' => 0, 'errors' => 0];

        foreach (self::BEFORE_TIERS as $type => $daysBefore) {
            $targetDate = now()->addDays($daysBefore)->toDateString();

            $assignments = ReviewAssignment::with(['reviewer', 'proposal:id,tracker_number,title', 'evaluationType:id,name,label'])
                ->whereIn('status', self::ACTIVE_STATUSES)
                ->whereNotNull('due_date')
                ->whereDate('due_date', $targetDate)
                ->get();

            foreach ($assignments as $assignment) {
                $this->sendIfDue($assignment, $type, $summary, fn () => $this->alreadySentToday($assignment, $type));
            }
        }

        $intervalDays = (int) (ThresholdSetting::where('key', 'overdue_reminder_interval_days')->value('value') ?? 3);

        $overdueAssignments = ReviewAssignment::with(['reviewer', 'proposal:id,tracker_number,title', 'evaluationType:id,name,label'])
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now()->toDateString())
            ->get();

        foreach ($overdueAssignments as $assignment) {
            $this->sendIfDue($assignment, 'overdue', $summary, function () use ($assignment, $intervalDays) {
                $lastOverdue = $assignment->reminders()->where('type', 'overdue')->latest('sent_at')->first();

                return $lastOverdue && $lastOverdue->sent_at->diffInDays(now()) < $intervalDays;
            });
        }

        Log::info('[ReviewReminderService] Scheduled reminders completed.', $summary);

        return $summary;
    }

    private function sendIfDue(ReviewAssignment $assignment, string $type, array &$summary, callable $shouldSkip): void
    {
        if ($shouldSkip()) {
            $summary['skipped']++;

            return;
        }

        try {
            $this->sendReminder($assignment, $type);
            $summary['sent']++;
        } catch (\Throwable $e) {
            Log::error("[ReviewReminderService] Failed to send {$type} reminder for assignment {$assignment->id}", [
                'error' => $e->getMessage(),
            ]);
            $summary['errors']++;
        }
    }

    private function alreadySentToday(ReviewAssignment $assignment, string $type): bool
    {
        return $assignment->reminders()->where('type', $type)->whereDate('sent_at', now()->toDateString())->exists();
    }
}
