<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each audit entry now says how it happened — the request method, the address and
 * the outcome (e.g. 403 for a blocked attempt) — and the log is indexed by time,
 * which every screen and export sorts on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->string('method', 10)->nullable()->after('event');
            $table->string('url', 500)->nullable()->after('method');
            $table->unsignedSmallInteger('status_code')->nullable()->after('url');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
            $table->dropColumn(['method', 'url', 'status_code']);
        });
    }
};
