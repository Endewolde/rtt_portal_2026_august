<?php

namespace App\Jobs\Concerns;

use App\Support\QueueWorker;

/**
 * `deliver(...)`: queue the job when a worker is running (the request returns at once and
 * failures are retried), otherwise run it now, exactly as before.
 */
trait DispatchesToWorkerWhenAlive
{
    public static function deliver(mixed ...$arguments): void
    {
        if (QueueWorker::isAlive()) {
            static::dispatch(...$arguments);

            return;
        }

        static::dispatchSync(...$arguments);
    }
}
