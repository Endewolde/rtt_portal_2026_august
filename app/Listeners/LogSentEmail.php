<?php

namespace App\Listeners;

use App\Models\EmailLog;
use Illuminate\Mail\Events\MessageSent;

/** Records every email the mailer actually handed off, whichever code path sent it. */
class LogSentEmail
{
    public function handle(MessageSent $event): void
    {
        $message = $event->message;
        $source = $message->getHeaders()->get(EmailLog::SOURCE_HEADER)?->getBodyAsString();

        foreach ($message->getTo() as $address) {
            EmailLog::sent($address->getAddress(), $message->getSubject(), $source);
        }
    }
}
