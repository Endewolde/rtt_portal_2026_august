<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('defence_sessions', function (Blueprint $table) {
            // Default score deadline is the end of the day after scheduled_date;
            // an approved extension replaces it.
            $table->dateTime('score_deadline_extended_until')->nullable()->after('final_score');
            $table->dateTime('deadline_reminder_sent_at')->nullable()->after('score_deadline_extended_until');
            $table->dateTime('flagged_incomplete_at')->nullable()->after('deadline_reminder_sent_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('defence_sessions', function (Blueprint $table) {
            $table->dropColumn(['score_deadline_extended_until', 'deadline_reminder_sent_at', 'flagged_incomplete_at']);
        });
    }
};
