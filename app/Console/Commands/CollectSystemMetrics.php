<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\SystemAlertNotification;
use Carbon\Carbon;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

#[Signature('metrics:collect')]
#[Description('Collect system and application metrics for the monitoring dashboard')]
class CollectSystemMetrics extends Command
{
    public function handle(): int
    {
        $now = now();
        $rows = [];

        // ── Server metrics ────────────────────────────────────────────────────
        $rows[] = $this->row('load_1m', $this->loadAvg(0), $now);
        $rows[] = $this->row('load_5m', $this->loadAvg(1), $now);
        $rows[] = $this->row('load_15m', $this->loadAvg(2), $now);

        $disk = $this->diskMetrics();
        $rows[] = $this->row('disk_used_pct', $disk['used_pct'], $now, ['free_gb' => $disk['free_gb'], 'total_gb' => $disk['total_gb']]);

        $mem = $this->memoryMetrics();
        $rows[] = $this->row('memory_used_pct', $mem['used_pct'], $now, ['used_gb' => $mem['used_gb'], 'total_gb' => $mem['total_gb']]);

        $cpu = $this->cpuUsage();
        $rows[] = $this->row('cpu_usage_pct', $cpu, $now);

        // ── Application metrics ───────────────────────────────────────────────
        $rows[] = $this->row('active_users', Cache::get('metric:active_users', 0), $now);
        $rows[] = $this->row('requests_per_minute', Cache::get('metric:rpm', 0), $now);

        // ── Database metrics ──────────────────────────────────────────────────
        $db = $this->dbMetrics();
        $rows[] = $this->row('db_connections', $db['connections'], $now);
        $rows[] = $this->row('db_slow_queries', $db['slow_queries'], $now);
        $rows[] = $this->row('db_query_count', $db['queries'], $now);

        // ── Queue metrics ─────────────────────────────────────────────────────
        $queuePending = DB::table('jobs')->count();
        $queueFailed = DB::table('failed_jobs')->count();
        $rows[] = $this->row('queue_pending', $queuePending, $now);
        $rows[] = $this->row('queue_failed', $queueFailed, $now);

        // Request metrics (computed from request_logs)
        $reqStats = $this->requestMetrics();
        $rows[] = $this->row('req_avg_ms', $reqStats['avg_ms'], $now);
        $rows[] = $this->row('req_error_rate', $reqStats['error_rate'], $now);
        $rows[] = $this->row('req_count', $reqStats['count'], $now);

        DB::table('system_metrics')->insert($rows);

        // ── Threshold alerts ──────────────────────────────────────────────────
        $newThresholdAlerts = $this->evaluateThresholds(
            $cpu, $mem['used_pct'], $disk['used_pct'], (int) $queueFailed
        );

        // ── Anomaly detection ─────────────────────────────────────────────────
        $newAnomalies = $this->detectAnomalies($cpu, $mem['used_pct'], $reqStats);

        // ── Notify super admins ───────────────────────────────────────────────
        $allNew = array_merge($newThresholdAlerts, $newAnomalies);
        if (! empty($allNew)) {
            $this->notifySuperAdmins($allNew);
        }

        // ── Housekeeping ──────────────────────────────────────────────────────
        Cache::put('metric:rpm', 0, 120);
        DB::table('system_metrics')->where('recorded_at', '<', now()->subDays(7))->delete();
        DB::table('request_logs')->where('requested_at', '<', now()->subDays(3))->delete();
        DB::table('system_alerts')->where('resolved', true)->where('resolved_at', '<', now()->subDays(7))->delete();

        $this->info('Metrics collected. New alerts: '.count($allNew));

        return self::SUCCESS;
    }

    // ── Data collection ───────────────────────────────────────────────────────

    private function row(string $metric, float $value, Carbon $now, ?array $meta = null): array
    {
        return [
            'metric' => $metric,
            'value' => round($value, 4),
            'meta' => $meta ? json_encode($meta) : null,
            'recorded_at' => $now,
        ];
    }

    private function loadAvg(int $index): float
    {
        return sys_getloadavg()[$index] ?? 0.0;
    }

    private function diskMetrics(): array
    {
        $free = disk_free_space('/');
        $total = disk_total_space('/');
        $usedPct = $total > 0 ? round(($total - $free) / $total * 100, 1) : 0;

        return [
            'used_pct' => $usedPct,
            'free_gb' => round($free / 1073741824, 2),
            'total_gb' => round($total / 1073741824, 2),
        ];
    }

    private function memoryMetrics(): array
    {
        $meminfo = @file_get_contents('/proc/meminfo');
        if ($meminfo) {
            preg_match('/MemTotal:\s+(\d+)\s+kB/', $meminfo, $total);
            preg_match('/MemAvailable:\s+(\d+)\s+kB/', $meminfo, $avail);
            $totalKb = (int) ($total[1] ?? 0);
            $availKb = (int) ($avail[1] ?? 0);
            if ($totalKb > 0) {
                $usedKb = $totalKb - $availKb;

                return [
                    'used_pct' => round($usedKb / $totalKb * 100, 1),
                    'used_gb' => round($usedKb / 1048576, 2),
                    'total_gb' => round($totalKb / 1048576, 2),
                ];
            }
        }

        $totalBytes = (int) trim((string) shell_exec('sysctl -n hw.memsize 2>/dev/null'));
        $vmstat = shell_exec('vm_stat 2>/dev/null') ?? '';
        preg_match('/Pages free:\s+(\d+)/', $vmstat, $freeP);
        preg_match('/Pages inactive:\s+(\d+)/', $vmstat, $inactP);
        $pageSize = 16384;
        $freeBytes = ((int) ($freeP[1] ?? 0) + (int) ($inactP[1] ?? 0)) * $pageSize;
        $usedBytes = $totalBytes > 0 ? $totalBytes - $freeBytes : 0;

        return [
            'used_pct' => $totalBytes > 0 ? round($usedBytes / $totalBytes * 100, 1) : 0,
            'used_gb' => round($usedBytes / 1073741824, 2),
            'total_gb' => round($totalBytes / 1073741824, 2),
        ];
    }

    private function cpuUsage(): float
    {
        if (file_exists('/proc/stat')) {
            $s1 = $this->readProcStat();
            usleep(200000);
            $s2 = $this->readProcStat();
            $totalDiff = array_sum($s2) - array_sum($s1);
            $idleDiff = ($s2[3] + $s2[4]) - ($s1[3] + $s1[4]);

            return $totalDiff > 0 ? round((1 - $idleDiff / $totalDiff) * 100, 1) : 0.0;
        }

        $top = shell_exec("top -l 1 -n 0 2>/dev/null | grep 'CPU usage' | head -1") ?? '';
        if (preg_match('/(\d+\.\d+)%\s+user,\s+(\d+\.\d+)%\s+sys/', $top, $m)) {
            return round((float) $m[1] + (float) $m[2], 1);
        }

        $cores = (int) (trim((string) shell_exec('nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null')) ?: 1);

        return min(100, round((sys_getloadavg()[0] ?? 0) / $cores * 100, 1));
    }

    private function readProcStat(): array
    {
        $line = explode(' ', trim(explode("\n", (string) file_get_contents('/proc/stat'))[0]));
        array_shift($line);

        return array_map('intval', $line);
    }

    private function dbMetrics(): array
    {
        try {
            $status = DB::select('SHOW STATUS WHERE Variable_name IN ("Threads_connected","Slow_queries","Queries")');
            $map = collect($status)->pluck('Value', 'Variable_name');

            return [
                'connections' => (int) ($map['Threads_connected'] ?? 0),
                'slow_queries' => (int) ($map['Slow_queries'] ?? 0),
                'queries' => (int) ($map['Queries'] ?? 0),
            ];
        } catch (\Throwable) {
            return ['connections' => 0, 'slow_queries' => 0, 'queries' => 0];
        }
    }

    private function requestMetrics(): array
    {
        $row = DB::table('request_logs')
            ->where('requested_at', '>=', now()->subMinutes(5))
            ->selectRaw('COUNT(*) as cnt, AVG(duration_ms) as avg_ms, SUM(status_code >= 400) as failed')
            ->first();

        $count = (int) ($row?->cnt ?? 0);
        $avgMs = round((float) ($row?->avg_ms ?? 0), 1);
        $failed = (int) ($row?->failed ?? 0);
        $errorRate = $count > 0 ? round($failed / $count * 100, 1) : 0.0;

        return ['count' => $count, 'avg_ms' => $avgMs, 'error_rate' => $errorRate];
    }

    // ── Threshold alerts ──────────────────────────────────────────────────────

    private function evaluateThresholds(float $cpu, float $mem, float $disk, int $failedJobs): array
    {
        $checks = [
            ['type' => 'cpu_critical',   'severity' => 'critical', 'value' => $cpu,        'threshold' => 90,  'message' => "CPU usage is {$cpu}% (threshold 90%)"],
            ['type' => 'cpu_warning',    'severity' => 'warning',  'value' => $cpu,        'threshold' => 75,  'message' => "CPU usage is {$cpu}% (threshold 75%)"],
            ['type' => 'memory_critical', 'severity' => 'critical', 'value' => $mem,        'threshold' => 90,  'message' => "Memory usage is {$mem}% (threshold 90%)"],
            ['type' => 'memory_warning', 'severity' => 'warning',  'value' => $mem,        'threshold' => 80,  'message' => "Memory usage is {$mem}% (threshold 80%)"],
            ['type' => 'disk_critical',  'severity' => 'critical', 'value' => $disk,       'threshold' => 95,  'message' => "Disk usage is {$disk}% (threshold 95%)"],
            ['type' => 'disk_warning',   'severity' => 'warning',  'value' => $disk,       'threshold' => 85,  'message' => "Disk usage is {$disk}% (threshold 85%)"],
            ['type' => 'failed_jobs',    'severity' => 'warning',  'value' => $failedJobs, 'threshold' => 10,  'message' => "Failed jobs count is {$failedJobs} (threshold 10)"],
        ];

        $newAlerts = [];
        foreach ($checks as $check) {
            $existing = DB::table('system_alerts')
                ->where('type', $check['type'])
                ->where('resolved', false)
                ->first();

            if ($check['value'] >= $check['threshold']) {
                if (! $existing) {
                    DB::table('system_alerts')->insert([
                        'type' => $check['type'],
                        'severity' => $check['severity'],
                        'message' => $check['message'],
                        'context' => json_encode(['value' => $check['value'], 'threshold' => $check['threshold']]),
                        'resolved' => false,
                        'notified' => false,
                        'triggered_at' => now(),
                    ]);
                    $newAlerts[] = [
                        'type' => $check['type'],
                        'severity' => $check['severity'],
                        'message' => $check['message'],
                        'context' => ['value' => $check['value'], 'threshold' => $check['threshold']],
                    ];
                } elseif (! $existing->notified) {
                    // Send notification for existing un-notified alert
                    DB::table('system_alerts')->where('id', $existing->id)->update(['notified' => true]);
                    $newAlerts[] = [
                        'type' => $check['type'],
                        'severity' => $check['severity'],
                        'message' => $check['message'],
                        'context' => ['value' => $check['value'], 'threshold' => $check['threshold']],
                    ];
                }
            } elseif ($existing) {
                DB::table('system_alerts')->where('id', $existing->id)->update([
                    'resolved' => true,
                    'resolved_at' => now(),
                ]);
            }
        }

        return $newAlerts;
    }

    // ── Anomaly detection ─────────────────────────────────────────────────────

    private function detectAnomalies(float $cpu, float $mem, array $reqStats): array
    {
        $anomalies = [];

        // Rolling baseline: last 30 data points (30 min)
        $baseline = function (string $metric) {
            $rows = DB::table('system_metrics')
                ->where('metric', $metric)
                ->orderByDesc('recorded_at')
                ->limit(30)
                ->pluck('value');

            if ($rows->count() < 5) {
                return null;
            }

            $values = $rows->map(fn ($v) => (float) $v)->toArray();
            $mean = array_sum($values) / count($values);
            $variance = array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $values)) / count($values);
            $stddev = sqrt($variance);

            return ['mean' => $mean, 'stddev' => $stddev];
        };

        // CPU spike: > mean + 3σ  AND > 20% absolute change
        $cpuBase = $baseline('cpu_usage_pct');
        if ($cpuBase && $cpuBase['stddev'] > 0) {
            $zScore = ($cpu - $cpuBase['mean']) / $cpuBase['stddev'];
            if ($zScore > 3 && $cpu > $cpuBase['mean'] + 20) {
                $anomalies[] = $this->insertAnomaly(
                    type: 'anomaly_cpu_spike',
                    severity: 'critical',
                    message: "CPU spike detected: {$cpu}% (baseline avg {$cpuBase['mean']}%)",
                    context: ['current' => $cpu, 'baseline_avg' => round($cpuBase['mean'], 1), 'z_score' => round($zScore, 1)],
                    anomalyType: 'cpu_spike',
                );
            }
        }

        // Memory spike: > mean + 3σ
        $memBase = $baseline('memory_used_pct');
        if ($memBase && $memBase['stddev'] > 0) {
            $zScore = ($mem - $memBase['mean']) / $memBase['stddev'];
            if ($zScore > 3 && $mem > $memBase['mean'] + 15) {
                $anomalies[] = $this->insertAnomaly(
                    type: 'anomaly_memory_spike',
                    severity: 'critical',
                    message: "Memory spike detected: {$mem}% (baseline avg {$memBase['mean']}%)",
                    context: ['current' => $mem, 'baseline_avg' => round($memBase['mean'], 1), 'z_score' => round($zScore, 1)],
                    anomalyType: 'memory_spike',
                );
            }
        }

        // Response time spike: > 3× baseline avg
        if ($reqStats['count'] >= 5) {
            $rtBase = $baseline('req_avg_ms');
            if ($rtBase && $rtBase['mean'] > 0) {
                $ratio = $reqStats['avg_ms'] / $rtBase['mean'];
                if ($ratio > 3 && $reqStats['avg_ms'] > 500) {
                    $anomalies[] = $this->insertAnomaly(
                        type: 'anomaly_response_spike',
                        severity: 'warning',
                        message: "Response time spike: {$reqStats['avg_ms']}ms (baseline avg {$rtBase['mean']}ms)",
                        context: ['current_ms' => $reqStats['avg_ms'], 'baseline_ms' => round($rtBase['mean'], 0), 'ratio' => round($ratio, 1)],
                        anomalyType: 'response_time_spike',
                    );
                }
            }
        }

        // Error rate surge: > 15% error rate with at least 10 requests
        if ($reqStats['count'] >= 10 && $reqStats['error_rate'] > 15) {
            $errBase = $baseline('req_error_rate');
            $prevRate = $errBase['mean'] ?? 0;
            if ($reqStats['error_rate'] > max(15, $prevRate * 3)) {
                $anomalies[] = $this->insertAnomaly(
                    type: 'anomaly_error_rate',
                    severity: 'critical',
                    message: "High error rate: {$reqStats['error_rate']}% of requests failing",
                    context: ['error_rate' => $reqStats['error_rate'], 'request_count' => $reqStats['count'], 'baseline_rate' => round($prevRate, 1)],
                    anomalyType: 'error_rate_surge',
                );
            }
        }

        // Queue drain stall: pending jobs growing vs baseline
        $queueBase = $baseline('queue_pending');
        $currentQueue = (int) DB::table('jobs')->count();
        if ($queueBase && $queueBase['mean'] > 0) {
            $ratio = $currentQueue / $queueBase['mean'];
            if ($ratio > 4 && $currentQueue > 50) {
                $anomalies[] = $this->insertAnomaly(
                    type: 'anomaly_queue_buildup',
                    severity: 'warning',
                    message: "Queue buildup detected: {$currentQueue} pending jobs (baseline avg {$queueBase['mean']})",
                    context: ['current' => $currentQueue, 'baseline_avg' => round($queueBase['mean'], 0), 'ratio' => round($ratio, 1)],
                    anomalyType: 'queue_buildup',
                );
            }
        }

        return array_filter($anomalies);
    }

    private function insertAnomaly(
        string $type,
        string $severity,
        string $message,
        array $context,
        string $anomalyType,
    ): ?array {
        // Deduplicate: only one active anomaly of each type at a time
        $exists = DB::table('system_alerts')
            ->where('type', $type)
            ->where('resolved', false)
            ->where('triggered_at', '>=', now()->subHour())
            ->exists();

        if ($exists) {
            return null;
        }

        DB::table('system_alerts')->insert([
            'type' => $type,
            'severity' => $severity,
            'message' => $message,
            'context' => json_encode($context),
            'resolved' => false,
            'notified' => false,
            'anomaly_type' => $anomalyType,
            'triggered_at' => now(),
        ]);

        return [
            'type' => $type,
            'severity' => $severity,
            'message' => $message,
            'context' => $context,
            'anomaly_type' => $anomalyType,
        ];
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    private function notifySuperAdmins(array $alerts): void
    {
        $admins = User::role('super_admin')->get();
        if ($admins->isEmpty()) {
            return;
        }

        foreach ($alerts as $alert) {
            // Respect per-admin preferences
            $notification = new SystemAlertNotification(
                alertType: $alert['type'],
                severity: $alert['severity'],
                message: $alert['message'],
                context: $alert['context'] ?? null,
                anomalyType: $alert['anomaly_type'] ?? null,
            );

            foreach ($admins as $admin) {
                $prefs = $admin->alert_preferences ?? [];

                // Check if this severity is enabled for this admin
                $minSeverity = $prefs['min_severity'] ?? 'warning';
                $severityRank = ['warning' => 1, 'critical' => 2];
                $alertRank = $severityRank[$alert['severity']] ?? 1;
                $minRank = $severityRank[$minSeverity] ?? 1;

                if ($alertRank < $minRank) {
                    continue;
                }

                // Rate-limit: max 1 notification per type per admin per 30 min
                $cacheKey = "alert_notified:{$admin->id}:{$alert['type']}";
                if (Cache::has($cacheKey)) {
                    continue;
                }

                Cache::put($cacheKey, 1, 1800);
                $admin->notify($notification);
            }
        }

        // Mark all as notified in DB
        DB::table('system_alerts')->where('notified', false)->update(['notified' => true]);
    }
}
