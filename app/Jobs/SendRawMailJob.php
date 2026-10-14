<?php

namespace App\Jobs;

use App\Jobs\Concerns\DispatchesToWorkerWhenAlive;
use App\Models\EmailLog;
use App\Services\MailConfigService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendRawMailJob implements ShouldQueue
{
    use Dispatchable, DispatchesToWorkerWhenAlive, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        public string $html,
        public string $to,
        public string $toName,
        public string $subject,
    ) {
        $this->onQueue('notifications');
    }

    public function handle(): void
    {
        app(MailConfigService::class)->applyFromDatabase();

        try {
            Mail::html(
                $this->html,
                function ($msg) {
                    $msg->to($this->to, $this->toName)->subject($this->subject);
                    $msg->getSymfonyMessage()->getHeaders()->addTextHeader(EmailLog::SOURCE_HEADER, 'raw_mail');
                }
            );
        } catch (\Exception $e) {
            EmailLog::failed($this->to, $this->subject, 'raw_mail', $e);
            Log::error("SendRawMailJob failed to {$this->to}: ".$e->getMessage());
            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('SendRawMailJob permanently failed', [
            'to' => $this->to,
            'error' => $exception->getMessage(),
        ]);
    }
}
