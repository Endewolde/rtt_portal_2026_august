<?php

namespace App\Console\Commands;

use App\Models\ProposalCall;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class SendDeadlineReminders extends Command
{
    protected $signature   = 'rtt:deadline-reminders';
    protected $description = 'Send deadline reminders for proposal calls closing soon';

    public function handle(NotificationService $notificationService): void
    {
        $reminderDays = [7, 3, 1];

        foreach ($reminderDays as $days) {
            $targetDate = now()->addDays($days)->toDateString();

            $calls = ProposalCall::where('status', 'active')
                ->whereDate('end_date', $targetDate)
                ->get();

            foreach ($calls as $call) {
                $pis = User::role('pi')
                    ->whereHas('proposals', fn ($q) => $q
                        ->where('proposal_call_id', $call->id)
                        ->where('status', 'draft')
                    )->get();

                foreach ($pis as $pi) {
                    $notificationService->send('deadline_reminder', $pi, [
                        'call_title'     => $call->title,
                        'days_remaining' => $days,
                        'deadline_date'  => $call->end_date->format('d M Y'),
                    ]);
                }

                $this->info("Sent {$days}-day reminders for call: {$call->title} ({$pis->count()} PIs).");
            }
        }
    }
}
