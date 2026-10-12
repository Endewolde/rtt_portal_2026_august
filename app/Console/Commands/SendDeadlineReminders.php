<?php

namespace App\Console\Commands;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendDeadlineReminders extends Command
{
    protected $signature = 'rtt:deadline-reminders';

    protected $description = 'Send deadline reminders for proposal calls closing soon';

    public function handle(): void
    {
        $reminderDays = [7, 3, 1];

        foreach ($reminderDays as $days) {
            $targetDate = now()->addDays($days)->toDateString();

            $calls = ProposalCall::where('status', 'active')
                ->whereDate('end_date', $targetDate)
                ->get();

            foreach ($calls as $call) {
                $data = [
                    'call_title' => $call->title,
                    'days_remaining' => $days,
                    'deadline_date' => $call->end_date->format('d M Y'),
                ];

                $draftProposals = Proposal::where('proposal_call_id', $call->id)
                    ->where('status', 'draft')
                    ->with(['pi', 'members.user'])
                    ->get();

                $notifiedUserIds = [];

                foreach ($draftProposals as $proposal) {
                    if ($proposal->pi) {
                        $this->remind($proposal->pi, $data, $notifiedUserIds);
                    }

                    foreach ($proposal->members->where('role', 'co_investigator')->where('status', 'active') as $member) {
                        if ($member->user) {
                            $this->remind($member->user, $data, $notifiedUserIds);
                        }
                    }
                }

                $count = count($notifiedUserIds);
                $this->info("Sent {$days}-day reminders for: {$call->title} ({$count} recipients).");
            }
        }
    }

    /**
     * @param  array<string>  $notifiedUserIds  Passed by reference to track who has already been reminded.
     */
    private function remind(User $user, array $data, array &$notifiedUserIds): void
    {
        if (in_array($user->id, $notifiedUserIds)) {
            return;
        }

        $notifiedUserIds[] = $user->id;

        if ($user->email) {
            try {
                SendEmailNotificationJob::dispatchSync($user, 'deadline_reminder', $data);
            } catch (\Exception $e) {
                Log::error("Deadline reminder email failed for {$user->email}: ".$e->getMessage());
            }
        }

        try {
            StoreInAppNotificationJob::dispatchSync($user->id, 'deadline_reminder', $data);
        } catch (\Exception $e) {
            Log::error("Deadline reminder in-app failed for user {$user->id}: ".$e->getMessage());
        }
    }
}
