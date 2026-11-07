<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * How long a sign-in lasts on the server. The browser already logs people out after the
 * "Session Timeout" of inactivity, but the token it keeps stays behind — on a shared
 * computer, reopening the browser hours later was still signed in. A token now also
 * stops working once it has gone unused for that long (plus a margin for a page read
 * without clicking), and in any case after MAX_AGE_DAYS.
 */
class TokenLifetime
{
    public const MAX_AGE_DAYS = 30;

    /** Margin over the session timeout, so a long read never logs anyone out early. */
    public const GRACE_MINUTES = 30;

    /** Without a session timeout set, an unused token still lapses after two weeks. */
    public const DEFAULT_IDLE_MINUTES = 14 * 24 * 60;

    public static function isAlive(PersonalAccessToken $token): bool
    {
        $lastSeen = $token->last_used_at ?? $token->created_at;

        return $token->created_at?->gt(now()->subDays(self::MAX_AGE_DAYS))
            && $lastSeen?->gt(now()->subMinutes(self::idleMinutes()));
    }

    public static function idleMinutes(): int
    {
        return Cache::remember('token_idle_minutes', 300, function () {
            $timeout = (int) DB::table('app_settings')->where('key', 'session_timeout_minutes')->value('value');

            return $timeout > 0 ? $timeout + self::GRACE_MINUTES : self::DEFAULT_IDLE_MINUTES;
        });
    }

    /** Remove tokens that can no longer sign anyone in. */
    public static function prune(): int
    {
        $idleCutoff = now()->subMinutes(self::idleMinutes());

        return PersonalAccessToken::query()
            ->where(fn ($q) => $q->where('created_at', '<', now()->subDays(self::MAX_AGE_DAYS))
                ->orWhere(fn ($i) => $i->whereNotNull('last_used_at')->where('last_used_at', '<', $idleCutoff))
                ->orWhere(fn ($n) => $n->whereNull('last_used_at')->where('created_at', '<', $idleCutoff)))
            ->delete();
    }
}
