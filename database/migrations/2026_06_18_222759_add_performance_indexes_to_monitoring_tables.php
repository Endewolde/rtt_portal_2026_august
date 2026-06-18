<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Composite index for baseline queries: WHERE metric = ? ORDER BY recorded_at DESC LIMIT 30
        Schema::table('system_metrics', function (Blueprint $table) {
            $table->index(['metric', 'recorded_at'], 'system_metrics_metric_recorded_idx');
        });

        // Composite index for percentile queries: WHERE requested_at >= ? ORDER BY duration_ms
        Schema::table('request_logs', function (Blueprint $table) {
            $table->index(['requested_at', 'duration_ms'], 'request_logs_at_duration_idx');
        });
    }

    public function down(): void
    {
        Schema::table('system_metrics', function (Blueprint $table) {
            $table->dropIndex('system_metrics_metric_recorded_idx');
        });

        Schema::table('request_logs', function (Blueprint $table) {
            $table->dropIndex('request_logs_at_duration_idx');
        });
    }
};
