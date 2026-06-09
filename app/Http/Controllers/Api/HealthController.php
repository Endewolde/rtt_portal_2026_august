<?php

namespace App\Http\Controllers\Api;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class HealthController
{
    public function check(): \Illuminate\Http\JsonResponse
    {
        $checks        = [];
        $overallStatus = 'ok';

        // Database
        try {
            DB::connection()->getPdo();
            $tableCount          = count(DB::select('SHOW TABLES'));
            $checks['database']  = ['status' => 'connected', 'tables' => $tableCount];
        } catch (\Exception $e) {
            $checks['database'] = ['status' => 'error', 'message' => $e->getMessage()];
            $overallStatus      = 'degraded';
        }

        // Redis (attempts a real round-trip; falls back gracefully if unavailable)
        try {
            Cache::store('redis')->put('health_check', true, 10);
            $checks['redis'] = ['status' => 'connected'];
        } catch (\Exception $e) {
            $checks['redis'] = ['status' => 'error', 'message' => $e->getMessage()];
            $overallStatus   = 'degraded';
        }

        // Private storage
        try {
            Storage::disk('private')->put('health_check.txt', 'ok');
            Storage::disk('private')->delete('health_check.txt');
            $checks['storage'] = ['status' => 'writable'];
        } catch (\Exception $e) {
            $checks['storage'] = ['status' => 'error', 'message' => $e->getMessage()];
            $overallStatus     = 'degraded';
        }

        // Queue — warn if too many failed jobs have accumulated
        try {
            $failedJobs     = DB::table('failed_jobs')->count();
            $queueStatus    = $failedJobs < 10 ? 'running' : 'degraded';
            $checks['queue'] = ['status' => $queueStatus, 'failed_jobs' => $failedJobs];

            if ($failedJobs >= 10) {
                $overallStatus = 'degraded';
            }
        } catch (\Exception $e) {
            $checks['queue'] = ['status' => 'error', 'message' => $e->getMessage()];
            $overallStatus   = 'degraded';
        }

        return response()->json([
            'status'    => $overallStatus,
            'version'   => config('app.version', '1.0.0'),
            'timestamp' => now()->toIso8601String(),
            'checks'    => $checks,
        ], $overallStatus === 'ok' ? 200 : 503);
    }
}
