<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('metric', 64)->index();
            $table->decimal('value', 15, 4);
            $table->json('meta')->nullable();
            $table->timestamp('recorded_at')->index();
        });

        Schema::create('request_logs', function (Blueprint $table) {
            $table->id();
            $table->string('method', 10);
            $table->string('path', 500);
            $table->unsignedSmallInteger('status_code');
            $table->unsignedInteger('duration_ms');
            $table->string('ip', 45)->nullable();
            $table->string('user_id', 36)->nullable();
            $table->boolean('is_api')->default(false);
            $table->timestamp('requested_at')->index();
        });

        Schema::create('system_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('type', 64)->index();
            $table->string('severity', 16)->default('warning');
            $table->string('message', 500);
            $table->json('context')->nullable();
            $table->boolean('resolved')->default(false);
            $table->timestamp('triggered_at');
            $table->timestamp('resolved_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_alerts');
        Schema::dropIfExists('request_logs');
        Schema::dropIfExists('system_metrics');
    }
};
