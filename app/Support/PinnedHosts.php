<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Sign-in providers' addresses, looked up in the background and kept, so signing in
 * never waits on a DNS lookup. On the production server lookups through the uplink
 * DNS sometimes take 10–30 seconds, which made Microsoft sign-in time out even though
 * the connection itself was fine.
 *
 * The scheduler refreshes the addresses every few minutes; a sign-in hands them to curl
 * (CURLOPT_RESOLVE), which still checks the certificate against the real host name.
 */
class PinnedHosts
{
    /** Hosts a sign-in calls, by provider. */
    public const HOSTS = [
        'microsoft' => ['login.microsoftonline.com', 'graph.microsoft.com'],
        'google' => ['oauth2.googleapis.com', 'www.googleapis.com', 'openidconnect.googleapis.com'],
    ];

    private const CACHE_KEY = 'pinned_hosts';

    /** Kept well past the refresh interval, so a missed refresh or two does no harm. */
    private const KEEP_HOURS = 12;

    /**
     * Look the hosts up again and keep what resolves; a host that fails keeps its last addresses.
     *
     * @param  (Closure(string): (list<string>|false))|null  $resolver  for tests; defaults to gethostbynamel
     * @return array<string, list<string>>
     */
    public static function refresh(?Closure $resolver = null): array
    {
        $resolver ??= fn (string $host) => gethostbynamel($host);
        $pinned = Cache::get(self::CACHE_KEY, []);

        foreach (array_merge(...array_values(self::HOSTS)) as $host) {
            $ips = $resolver($host);
            $ips = is_array($ips) ? array_values(array_filter($ips, fn ($ip) => filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4))) : [];
            if ($ips !== []) {
                $pinned[$host] = array_slice($ips, 0, 4);
            } elseif (! isset($pinned[$host])) {
                Log::warning("[SSO] Could not look up {$host} in the background; sign-in will look it up itself.");
            }
        }

        Cache::put(self::CACHE_KEY, $pinned, now()->addHours(self::KEEP_HOURS));

        return $pinned;
    }

    /**
     * The provider's hosts as curl CURLOPT_RESOLVE entries ("host:443:ip1,ip2"); empty
     * when nothing is known yet, which leaves curl to look them up as before.
     *
     * @return list<string>
     */
    public static function curlResolve(string $provider): array
    {
        $pinned = Cache::get(self::CACHE_KEY, []);

        return collect(self::HOSTS[$provider] ?? [])
            ->filter(fn ($host) => ! empty($pinned[$host]))
            ->map(fn ($host) => "{$host}:443:".implode(',', $pinned[$host]))
            ->values()->all();
    }
}
