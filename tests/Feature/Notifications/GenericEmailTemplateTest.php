<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

test('generic notification emails render their message text instead of failing', function () {
    $sent = [];
    Event::listen(MessageSent::class, function (MessageSent $event) use (&$sent) {
        $sent[] = $event->message->getHtmlBody();
    });

    $user = User::factory()->create();

    (new SendEmailNotificationJob($user, 'approval_report_submitted', [
        'tracker_number' => 'TRK-1',
        'message' => 'Officer flagged TRK-1. Issue: Not anonymous — author identity revealed',
    ]))->handle();

    expect($sent)->toHaveCount(1)
        ->and($sent[0])->toContain('Officer flagged TRK-1. Issue: Not anonymous');
});
