<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('alert_preferences')->nullable()->after('two_factor_enabled');
        });

        Schema::table('system_alerts', function (Blueprint $table) {
            $table->boolean('notified')->default(false)->after('resolved');
            $table->string('anomaly_type', 64)->nullable()->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('system_alerts', function (Blueprint $table) {
            $table->dropColumn(['notified', 'anomaly_type']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('alert_preferences');
        });
    }
};
