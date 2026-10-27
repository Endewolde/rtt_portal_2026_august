<?php

namespace App\Jobs;

use App\Jobs\Concerns\DispatchesToWorkerWhenAlive;
use App\Services\SmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/** Send one text message. */
class SendSmsJob implements ShouldQueue
{
    use Dispatchable, DispatchesToWorkerWhenAlive, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $backoff = 60;

    public function __construct(public string $phone, public string $message)
    {
        $this->onQueue('notifications');
    }

    public function handle(SmsService $sms): void
    {
        $sms->send($this->phone, $this->message);
    }
}
