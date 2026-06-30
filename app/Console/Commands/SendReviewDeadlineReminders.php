<?php

namespace App\Console\Commands;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\ReviewAssignment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendReviewDeadlineReminders extends Command
{
    protected $signature = 'rtt:review-deadline-reminders';

    protected $description = 'Send reminders to reviewers whose assignments are due in 1 or 3 days';

    public function handle(): void
    {
        $reminderDays = [3, 1];

        foreach ($reminderDays as $days) {
            $targetDate = now()->addDays($days)->toDateString();

            $assignments = ReviewAssignment::with(['reviewer', 'proposal:id,tracker_number,title'])
                ->whereIn('status', ['pending', 'in_progress'])
                ->whereDate('due_date', $targetDate)
                ->whereNotNull('due_date')
                ->get();

            foreach ($assignments as $assignment) {
                $reviewer = $assignment->reviewer;
                if (! $reviewer) {
                    continue;
                }

                $data = [
                    'reviewer_name' => $reviewer->name,
                    'tracker_number' => $assignment->proposal?->tracker_number ?? '—',
                    'proposal_title' => $assignment->proposal?->title ?? '—',
                    'days_remaining' => $days,
                    'due_date' => $assignment->due_date?->format('d M Y') ?? '—',
                    'review_url' => config('app.url').'/reviews/'.$assignment->id.'/score',
                ];

                SendEmailNotificationJob::dispatchSync($reviewer, 'review_deadline_reminder', $data);
                StoreInAppNotificationJob::dispatchSync($reviewer->id, 'review_deadline_reminder', $data);

                $this->line("  Reminded {$reviewer->name} — {$data['tracker_number']} due in {$days}d");
            }
        }

        Log::info('[rtt:review-deadline-reminders] Completed.');
        $this->info('Review deadline reminders sent.');
    }
}
