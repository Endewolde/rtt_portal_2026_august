<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
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
        $recipients = $this->resolveRecipients();

        foreach ($recipients as $user) {
            try {
                Mail::raw($this->payload['message'], function ($m) use ($user) {
                    $m->to($user->email, $user->name)
                      ->subject($this->payload['subject']);
                });
            } catch (\Exception $e) {
                Log::error('Broadcast email failed for '.$user->email.': '.$e->getMessage());
            }
        }
    }

    private function resolveRecipients(): \Illuminate\Support\Collection
    {
        return match ($this->payload['to']) {
            'all'      => User::whereNotNull('email')->get(['id', 'name', 'email']),
            'by_role'  => User::role($this->payload['role'] ?? '')->get(['id', 'name', 'email']),
            'specific' => User::where('email', $this->payload['email'])->get(['id', 'name', 'email']),
            default    => collect(),
        };
    }
}
