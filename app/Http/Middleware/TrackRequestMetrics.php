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

        // Track active users: mark user active for 5 minutes
        if ($request->user()) {
            $key = 'metric:active_user:'.$request->user()->id;
            Cache::put($key, 1, 300);
            $count = Cache::get('metric:active_users_count', 0);
            // Recount every 10 requests roughly
            if (random_int(1, 10) === 1) {
                $this->recountActiveUsers();
            }
        }

        return $response;
    }

    private function recountActiveUsers(): void
    {
        // Count how many active_user keys exist - approximate using DB users seen recently
        $count = DB::table('request_logs')
            ->where('requested_at', '>=', now()->subMinutes(5))
            ->whereNotNull('user_id')
            ->distinct('user_id')
            ->count('user_id');

        Cache::put('metric:active_users', $count, 360);
    }
}
