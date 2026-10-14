<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use App\Models\User;
use App\Notifications\SystemAlertNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SystemMonitorController extends Controller
{
    public function current(Request $request): JsonResponse
    {
        if (! $request->user()?->can('system_monitor.view_any')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'data' => $this->snapshot(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        if (! $request->user()?->can('system_monitor.view_any')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $minutes = min((int) $request->query('minutes', 60), 1440);
        $since = now()->subMinutes($minutes);

        $metrics = DB::table('system_metrics')
            ->where('recorded_at', '>=', $since)
            ->orderBy('recorded_at')
            ->get(['metric', 'value', 'meta', 'recorded_at']);

        $grouped = $metrics->groupBy('metric')->map(fn ($rows) => $rows->map(fn ($r) => [
            'value' => (float) $r->value,
            'meta' => $r->meta ? json_decode($r->meta, true) : null,
            'recorded_at' => $r->recorded_at,
        ])->values());

        return response()->json([
            'data' => $grouped,
            'message' => '',
            'errors' => [],
            'meta' => ['minutes' => $minutes],
        ]);
    }

    public function requestStats(Request $request): JsonResponse
    {
        if (! $request->user()?->can('system_monitor.view_any')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $minutes = min((int) $request->query('minutes', 60), 1440);
        $since = now()->subMinutes($minutes);

        $base = DB::table('request_logs')->where('requested_at', '>=', $since);

        $total = (clone $base)->count();
        $failed = (clone $base)->where('status_code', '>=', 400)->count();
        $avgMs = (clone $base)->avg('duration_ms') ?? 0;
        $slowCount = (clone $base)->where('duration_ms', '>', 2000)->count();
        $p95 = (int) (DB::table('system_metrics')->where('metric', 'req_p95_ms')->orderByDesc('recorded_at')->value('value') ?? 0);
        $p99 = (int) (DB::table('system_metrics')->where('metric', 'req_p99_ms')->orderByDesc('recorded_at')->value('value') ?? 0);

        $byStatus = (clone $base)
            ->selectRaw('status_code, COUNT(*) as count')
            ->groupBy('status_code')
            ->orderBy('status_code')
            ->get();

        $topSlow = (clone $base)
            ->select('method', 'path', 'status_code', 'duration_ms', 'requested_at')
            ->orderByDesc('duration_ms')
            ->limit(10)
            ->get();

        $rpmTimeline = (clone $base)
            ->selectRaw('DATE_FORMAT(requested_at, "%Y-%m-%d %H:%i:00") as minute, COUNT(*) as count, AVG(duration_ms) as avg_ms')
            ->groupByRaw('DATE_FORMAT(requested_at, "%Y-%m-%d %H:%i:00")')
            ->orderBy('minute')
            ->get();

        $errorPaths = (clone $base)
            ->where('status_code', '>=', 400)
            ->selectRaw('path, status_code, COUNT(*) as count')
            ->groupBy('path', 'status_code')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        return response()->json([
            'data' => [
                'total' => $total,
                'failed' => $failed,
                'success_rate' => $total > 0 ? round(($total - $failed) / $total * 100, 1) : 100,
                'avg_ms' => round($avgMs, 0),
                'slow_count' => $slowCount,
                'p95_ms' => $p95,
                'p99_ms' => $p99,
                'by_status' => $byStatus,
                'top_slow' => $topSlow,
                'rpm_timeline' => $rpmTimeline,
                'error_paths' => $errorPaths,
            ],
            'message' => '',
            'errors' => [],
            'meta' => ['minutes' => $minutes],
        ]);
    }

    /** Outgoing email delivery log with 24h / 7d delivery figures. */
    public function emailLog(Request $request): JsonResponse
    {
        if (! $request->user()?->can('system_monitor.view_any')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $logs = EmailLog::query()
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->search, fn ($q, $term) => $q->where(fn ($q) => $q
                ->where('to_email', 'like', "%{$term}%")
                ->orWhere('subject', 'like', "%{$term}%")
                ->orWhere('source', 'like', "%{$term}%")))
            ->orderByDesc('created_at')
            ->paginate(50);

        $countSince = fn (string $status, $since) => EmailLog::where('status', $status)->where('created_at', '>=', $since)->count();
        $day = now()->subDay();
        $week = now()->subWeek();

        return response()->json([
            'data' => $logs,
            'message' => '',
            'errors' => [],
            'meta' => [
                'stats' => [
                    'sent_24h' => $countSince('sent', $day),
                    'failed_24h' => $countSince('failed', $day),
                    'sent_7d' => $countSince('sent', $week),
                    'failed_7d' => $countSince('failed', $week),
                    'last_failure' => EmailLog::where('status', 'failed')->latest('created_at')->first(['created_at', 'error', 'source']),
                ],
            ],
        ]);
    }

    public function failedJobs(Request $request): JsonResponse
    {
        if (! $request->user()?->can('system_monitor.view_any')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $jobs = DB::table('failed_jobs')
            ->orderByDesc('failed_at')
            ->get(['id', 'uuid', 'queue', 'connection', 'payload', 'exception', 'failed_at']);

        $formatted = $jobs->map(function ($job) {
            $payload = json_decode($job->payload, true);
            $displayName = $payload['displayName'] ?? $payload['job'] ?? 'Unknown Job';
            $shortName = class_basename(str_replace('\\', '/', $displayName));
            $exceptionFirstLine = trim(explode("\n", $job->exception)[0]);

            return [
                'id' => $job->id,
                'uuid' => $job->uuid,
                'queue' => $job->queue,
                'connection' => $job->connection,
                'job_name' => $shortName,
                'job_class' => $displayName,
                'error' => $exceptionFirstLine,
                'failed_at' => $job->failed_at,
            ];
        });

        return response()->json([
            'data' => $formatted,
            'message' => '',
            'errors' => [],
            'meta' => ['total' => $formatted->count()],
        ]);
    }

    public function retryFailedJob(Request $request, string $uuid): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $exists = DB::table('failed_jobs')->where('uuid', $uuid)->exists();
        if (! $exists) {
            return response()->json(['data' => null, 'message' => 'Job not found.'], 404);
        }

        Artisan::call('queue:retry', ['id' => [$uuid]]);

        return response()->json(['data' => null, 'message' => 'Job queued for retry.', 'errors' => [], 'meta' => []]);
    }

    public function forgetFailedJob(Request $request, string $uuid): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        DB::table('failed_jobs')->where('uuid', $uuid)->delete();

        return response()->json(['data' => null, 'message' => 'Job deleted.', 'errors' => [], 'meta' => []]);
    }

    public function retryAllFailedJobs(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        Artisan::call('queue:retry', ['id' => ['all']]);

        return response()->json(['data' => null, 'message' => 'All failed jobs queued for retry.', 'errors' => [], 'meta' => []]);
    }

    public function flushFailedJobs(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        DB::table('failed_jobs')->truncate();

        return response()->json(['data' => null, 'message' => 'All failed jobs deleted.', 'errors' => [], 'meta' => []]);
    }

    public function alerts(Request $request): JsonResponse
    {
        if (! $request->user()?->can('system_monitor.view_any')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $active = DB::table('system_alerts')
            ->where('resolved', false)
            ->orderByDesc('triggered_at')
            ->get();

        $recent = DB::table('system_alerts')
            ->where('resolved', true)
            ->where('resolved_at', '>=', now()->subHours(24))
            ->orderByDesc('resolved_at')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => ['active' => $active, 'recent' => $recent],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function resolveAlert(Request $request, int $id): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        DB::table('system_alerts')->where('id', $id)->update([
            'resolved' => true,
            'resolved_at' => now(),
        ]);

        return response()->json(['data' => null, 'message' => 'Alert resolved.', 'errors' => [], 'meta' => []]);
    }

    public function getPreferences(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $defaults = [
            'email_enabled' => true,
            'min_severity' => 'warning',
            'anomaly_detection' => true,
            'thresholds' => [
                'cpu_warning' => 75,
                'cpu_critical' => 90,
                'memory_warning' => 80,
                'memory_critical' => 90,
                'disk_warning' => 85,
                'disk_critical' => 95,
                'failed_jobs' => 10,
            ],
        ];

        $saved = $request->user()->alert_preferences ?? [];
        $prefs = array_replace_recursive($defaults, $saved);

        return response()->json(['data' => $prefs, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function savePreferences(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'email_enabled' => 'boolean',
            'min_severity' => 'in:warning,critical',
            'anomaly_detection' => 'boolean',
            'thresholds.cpu_warning' => 'integer|min:10|max:100',
            'thresholds.cpu_critical' => 'integer|min:10|max:100',
            'thresholds.memory_warning' => 'integer|min:10|max:100',
            'thresholds.memory_critical' => 'integer|min:10|max:100',
            'thresholds.disk_warning' => 'integer|min:10|max:100',
            'thresholds.disk_critical' => 'integer|min:10|max:100',
            'thresholds.failed_jobs' => 'integer|min:1|max:1000',
        ]);

        $request->user()->update(['alert_preferences' => $validated]);

        return response()->json(['data' => $validated, 'message' => 'Preferences saved.', 'errors' => [], 'meta' => []]);
    }

    public function testAlert(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $request->user()->notify(new SystemAlertNotification(
            alertType: 'test_alert',
            severity: 'warning',
            message: 'This is a test alert from the RTT System Monitor.',
            context: ['triggered_by' => $request->user()->name, 'note' => 'Test notification'],
        ));

        return response()->json(['data' => null, 'message' => 'Test alert sent to your email and notification bell.', 'errors' => [], 'meta' => []]);
    }

    private function userStats(): array
    {
        return [
            'live_online' => User::where('last_activity_at', '>=', now()->subMinutes(5))->count(),
            'active_users' => User::where('last_activity_at', '>=', now()->subMinutes(30))->count(),
            'ever_logged_in' => User::whereNotNull('last_login_at')->count(),
            'first_time_today' => User::whereDate('first_login_at', today())->count(),
        ];
    }

    private function snapshot(): array
    {
        // Latest value of each server metric
        $latestMetrics = DB::table('system_metrics')
            ->select('metric', DB::raw('MAX(id) as max_id'))
            ->groupBy('metric')
            ->get()
            ->pluck('max_id');

        $metrics = DB::table('system_metrics')
            ->whereIn('id', $latestMetrics)
            ->get(['metric', 'value', 'meta'])
            ->keyBy('metric');

        $get = fn (string $k) => isset($metrics[$k]) ? (float) $metrics[$k]->value : null;
        $getMeta = fn (string $k) => isset($metrics[$k]) && $metrics[$k]->meta ? json_decode($metrics[$k]->meta, true) : null;

        // Live app stats (no historical lag)
        $activeUsers = User::where('last_activity_at', '>=', now()->subMinutes(5))->count();
        $rpm = Cache::get('metric:rpm', 0);
        $queuePending = DB::table('jobs')->count();
        $queueFailed = DB::table('failed_jobs')->count();
        $dbConnections = (int) (DB::selectOne('SHOW STATUS WHERE Variable_name = "Threads_connected"')?->Value ?? 0);

        $last5MinReqs = DB::table('request_logs')
            ->where('requested_at', '>=', now()->subMinutes(5))
            ->selectRaw('COUNT(*) as total, SUM(status_code >= 400) as failed, AVG(duration_ms) as avg_ms')
            ->first();

        $userStats = $this->userStats();

        return [
            'server' => [
                'cpu_pct' => $get('cpu_usage_pct'),
                'memory_pct' => $get('memory_used_pct'),
                'memory_meta' => $getMeta('memory_used_pct'),
                'disk_pct' => $get('disk_used_pct'),
                'disk_meta' => $getMeta('disk_used_pct'),
                'load_1m' => $get('load_1m'),
                'load_5m' => $get('load_5m'),
                'load_15m' => $get('load_15m'),
            ],
            'app' => [
                'active_users' => $activeUsers,
                'rpm' => $rpm,
                'queue_pending' => $queuePending,
                'queue_failed' => $queueFailed,
                'db_connections' => $dbConnections,
                'requests_5m' => (int) ($last5MinReqs?->total ?? 0),
                'failed_5m' => (int) ($last5MinReqs?->failed ?? 0),
                'avg_response_ms' => round((float) ($last5MinReqs?->avg_ms ?? 0), 0),
            ],
            'users' => $userStats,
            'alerts_count' => DB::table('system_alerts')->where('resolved', false)->count(),
            'collected_at' => now()->toIso8601String(),
        ];
    }
}
