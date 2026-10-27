<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** When researchers whose expertise matches were told about the opportunity — so nobody is told twice. */
    public function up(): void
    {
        Schema::table('ef_opportunities', function (Blueprint $table) {
            $table->timestamp('match_alerts_sent_at')->nullable()->after('is_featured');
        });
    }

    public function down(): void
    {
        Schema::table('ef_opportunities', function (Blueprint $table) {
            $table->dropColumn('match_alerts_sent_at');
        });
    }
};
