<?php

use App\Jobs\QueueHeartbeatJob;
use App\Jobs\SendEmailNotificationJob;
use App\Models\User;
use App\Support\QueueWorker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

test('during a web request without a worker, mail is sent after the response so the user is not kept waiting', function () {
    Bus::fake();
    Cache::forget('queue_worker_heartbeat');
    $console = new ReflectionProperty(app(), 'isRunningInConsole');
    $console->setValue(app(), false);

    try {
        SendEmailNotificationJob::deliver(User::factory()->create(), 'generic', ['message' => 'Hi']);
    } finally {
        $console->setValue(app(), true);
    }

    Bus::assertDispatchedAfterResponse(SendEmailNotificationJob::class);
    Bus::assertNotDispatchedSync(SendEmailNotificationJob::class);
});

test('in scheduled commands without a worker, mail is sent immediately', function () {
    Bus::fake();
    Cache::forget('queue_worker_heartbeat');

    SendEmailNotificationJob::deliver(User::factory()->create(), 'generic', ['message' => 'Hi']);

    Bus::assertDispatchedSync(SendEmailNotificationJob::class);
});

test('with a worker that checked in recently, mail is queued', function () {
    Bus::fake();
    QueueWorker::beat();

    SendEmailNotificationJob::deliver(User::factory()->create(), 'generic', ['message' => 'Hi']);

    Bus::assertDispatched(SendEmailNotificationJob::class);
    Bus::assertNotDispatchedSync(SendEmailNotificationJob::class);
});

test('a worker that stopped checking in counts as down', function () {
    QueueWorker::beat();
    $this->travel(4)->minutes();

    expect(QueueWorker::isAlive())->toBeFalse();
});

test('the heartbeat marks the worker alive and is never queued twice', function () {
    config(['queue.default' => 'database']);

    QueueHeartbeatJob::queueIfIdle();
    QueueHeartbeatJob::queueIfIdle();
    expect(DB::table('jobs')->where('payload', 'like', '%QueueHeartbeatJob%')->count())->toBe(1);

    (new QueueHeartbeatJob)->handle();
    expect(QueueWorker::isAlive())->toBeTrue();
});
