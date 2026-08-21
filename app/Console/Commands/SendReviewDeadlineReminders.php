<?php

namespace App\Console\Commands;

use App\Services\ReviewReminderService;
use Illuminate\Console\Command;

class SendReviewDeadlineReminders extends Command
{
    protected $signature = 'rtt:review-deadline-reminders';

    protected $description = 'Send reviewers reminders 7/3/1 days before their due date, on the due date, and repeatedly while overdue';

    public function handle(ReviewReminderService $reminders): void
    {
        $summary = $reminders->runScheduledReminders();

        $this->info("Review deadline reminders completed — sent: {$summary['sent']}, skipped: {$summary['skipped']}, errors: {$summary['errors']}.");
    }
}
