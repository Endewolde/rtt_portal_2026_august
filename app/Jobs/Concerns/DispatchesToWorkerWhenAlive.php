<?php

namespace App\Jobs\Concerns;

use App\Support\QueueWorker;

/**
 * `deliver(...)`, fastest first:
 * - a queue worker is running → queue it (retried on failure);
 * - during a web request with no worker → send right after the response has gone to the
 *   browser, so the user isn't kept waiting on the mail server;
 * - otherwise (scheduled commands, tests) → send now.
 */
trait DispatchesToWorkerWhenAlive
{
    public static function deliver(mixed ...$arguments): void
    {
        if (QueueWorker::isAlive()) {
            static::dispatch(...$arguments);

            return;
        }

        if (! app()->runningInConsole()) {
            static::dispatchAfterResponse(...$arguments);

            return;
        }

        static::dispatchSync(...$arguments);
    }
}
