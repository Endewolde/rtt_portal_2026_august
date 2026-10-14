<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Possible conflicts of interest an officer confirmed when assigning this blind reviewer. */
    public function up(): void
    {
        Schema::table('review_assignments', function (Blueprint $table) {
            $table->json('acknowledged_conflicts')->nullable()->after('coi_resolved_at');
        });
    }

    public function down(): void
    {
        Schema::table('review_assignments', function (Blueprint $table) {
            $table->dropColumn('acknowledged_conflicts');
        });
    }
};
