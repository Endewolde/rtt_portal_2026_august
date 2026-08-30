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
        Schema::table('review_assignments', function (Blueprint $table) {
            // coi_declared_at already exists (records the "no conflict" acknowledgment).
            // These two capture the other branch — an actual reported conflict.
            $table->boolean('coi_has_conflict')->nullable()->after('coi_declared_at');
            $table->text('coi_reason')->nullable()->after('coi_has_conflict');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('review_assignments', function (Blueprint $table) {
            $table->dropColumn(['coi_has_conflict', 'coi_reason']);
        });
    }
};
