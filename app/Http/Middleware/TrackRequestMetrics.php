<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class TrackRequestMetrics
{
    public function handle(Request $request, Closure $next): Response
    {
        $start = microtime(true);
        $response = $next($request);
        $durationMs = (int) round((microtime(true) - $start) * 1000);

        // Skip internal Vite/hot-reload and asset requests
        $path = $request->path();
        if (str_starts_with($path, '_') || str_ends_with($path, '.ico') || str_starts_with($path, 'vendor/')) {
            return $response;
        }

        $isApi = $request->is('api/*');
        $status = $response->getStatusCode();

        // Async write to avoid slowing the response
        try {
            DB::table('request_logs')->insert([
                'method' => $request->method(),
                'path' => substr($path, 0, 500),
                'status_code' => $status,
                'duration_ms' => $durationMs,
                'ip' => $request->ip(),
                'user_id' => $request->user()?->id,
                'is_api' => $isApi,
                'requested_at' => now(),
            ]);
        } catch (\Throwable) {
            // Never let metrics break the app
        }

        // Increment RPM counter (expires after 2 min; reset by CollectSystemMetrics)
        Cache::increment('metric:rpm');

        // Update last_activity_at for authenticated users (throttled to once per minute)
        if ($request->user()) {
            $userId = $request->user()->id;
            $throttleKey = 'user:activity_throttle:'.$userId;

            if (! Cache::has($throttleKey)) {
                Cache::put($throttleKey, 1, 60);
                try {
                    DB::table('users')->where('id', $userId)->update(['last_activity_at' => now()]);
                } catch (\Throwable) {
                    // Never let metrics break the app
                }
            }
        }

        return $response;
    }
}
