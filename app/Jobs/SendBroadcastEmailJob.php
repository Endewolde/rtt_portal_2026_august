<?php

namespace App\Jobs;

use App\Models\EmailLog;
use App\Models\User;
use App\Services\MailConfigService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendBroadcastEmailJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly array $payload,
        public readonly string $senderId
    ) {}

    public function handle(): void
    {
        app(MailConfigService::class)->applyFromDatabase();

        $recipients = $this->resolveRecipients();

        foreach ($recipients as $user) {
            try {
                Mail::raw($this->payload['message'], function ($m) use ($user) {
                    $m->to($user->email, $user->name)
                        ->subject($this->payload['subject']);
                    $m->getSymfonyMessage()->getHeaders()->addTextHeader(EmailLog::SOURCE_HEADER, 'broadcast');
                });
            } catch (\Exception $e) {
                EmailLog::failed($user->email, $this->payload['subject'] ?? null, 'broadcast', $e);
                Log::error('Broadcast email failed for '.$user->email.': '.$e->getMessage());
            }
        }
    }

    private function resolveRecipients(): Collection
    {
        return match ($this->payload['to']) {
            'all' => User::whereNotNull('email')->where('status', 'active')->get(['id', 'name', 'email']),
            'by_role' => User::role($this->payload['role'] ?? '')->where('status', 'active')->get(['id', 'name', 'email']),
            'by_college' => User::where('college_id', $this->payload['college_id'])->where('status', 'active')->get(['id', 'name', 'email']),
            'specific' => User::where('email', $this->payload['email'])->get(['id', 'name', 'email']),
            default => collect(),
        };
    }
}
