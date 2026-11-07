<?php

namespace App\Console\Commands;

use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\Partnership;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('rtt:partnership-reminders')]
#[Description('Email the focal person and the technology transfer office about agreements that end within 90 days.')]
class PartnershipExpiryReminders extends Command
{
    /** Reminders go out at most this often per agreement. */
    private const EVERY_DAYS = 30;

    public function handle(): int
    {
        $due = Partnership::with('focalPerson:id,name,email')->inState('expiring')
            ->where(fn ($q) => $q->whereNull('reminded_on')->orWhere('reminded_on', '<=', now()->subDays(self::EVERY_DAYS)->toDateString()))
            ->get();
        if ($due->isEmpty()) {
            return self::SUCCESS;
        }

        $office = User::permission('partnerships.manage')->where('status', 'active')->whereNotNull('email')->get(['id', 'name', 'email']);
        $systemName = AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name');

        foreach ($due as $partnership) {
            $recipients = $office->push($partnership->focalPerson)->filter(fn ($u) => $u?->email)->unique('id');
            foreach ($recipients as $user) {
                SendRawMailJob::deliver(
                    view('emails.partnership_expiring', ['partnership' => $partnership, 'name' => $user->name, 'senderName' => $systemName,
                        'url' => rtrim(config('app.url'), '/').'/admin/tech-transfer?tab=partnerships'])->render(),
                    $user->email,
                    $user->name,
                    "Agreement ending {$partnership->expires_on->format('j M Y')} — {$partnership->partner_name}"
                );
            }
            $partnership->update(['reminded_on' => now()->toDateString()]);
        }

        $this->info("Reminded about {$due->count()} agreement(s).");

        return self::SUCCESS;
    }
}
