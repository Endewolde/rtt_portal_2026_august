<?php

namespace App\Jobs;

use App\Support\QueueWorker;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\DB;

/** Proves a worker is processing the notifications queue (see QueueWorker). */
class QueueHeartbeatJob implements ShouldQueue
{
    use Dispatchable, Queueable;

    public function __construct()
    {
        $this->onQueue('notifications');
    }

    public function handle(): void
    {
        QueueWorker::beat();
    }

    /** Queue a heartbeat unless one is already waiting — without a worker they would pile up. */
    public static function queueIfIdle(): void
    {
        $waiting = config('queue.default') === 'database'
            && DB::table(config('queue.connections.database.table', 'jobs'))->where('payload', 'like', '%QueueHeartbeatJob%')->exists();

        if (! $waiting) {
            static::dispatch();
        }
    }
}
