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
        Schema::table('notification_preferences', function (Blueprint $table) {
            $table->enum('digest_frequency', ['realtime', 'daily', 'weekly'])->default('realtime')->after('events_config');
            $table->timestamp('last_digest_sent_at')->nullable()->after('digest_frequency');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            $table->dropColumn(['digest_frequency', 'last_digest_sent_at']);
        });
    }
};
