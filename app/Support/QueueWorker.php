<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Whether a queue worker is actually processing jobs, from a heartbeat job the scheduler
 * queues every minute. Mail goes to the queue only while this is true; otherwise it is
 * sent straight away, so nothing waits in a queue no one is working.
 */
class QueueWorker
{
    private const CACHE_KEY = 'queue_worker_heartbeat';

    /** A worker that hasn't processed the heartbeat for this long is treated as down. */
    private const STALE_AFTER_MINUTES = 3;

    public static function beat(): void
    {
        Cache::forever(self::CACHE_KEY, now()->toIso8601String());
    }

    public static function lastSeen(): ?Carbon
    {
        $value = Cache::get(self::CACHE_KEY);

        return $value ? Carbon::parse($value) : null;
    }

    public static function isAlive(): bool
    {
        $lastSeen = self::lastSeen();

        return $lastSeen !== null && $lastSeen->gt(now()->subMinutes(self::STALE_AFTER_MINUTES));
    }
}
