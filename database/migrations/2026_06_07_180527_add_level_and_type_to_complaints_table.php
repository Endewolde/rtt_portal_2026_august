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
        Schema::table('complaints', function (Blueprint $table) {
            // 'college' = Level 1 (blind/open defence, handled by college_officer)
            // 'officer' = Level 2 (post-funding, handled by category officer)
            $table->string('level', 20)->default('college')->after('stage');

            // For Level 2: 'budget', 'rejection', 'other'
            $table->string('complaint_type', 30)->nullable()->after('level');

            // When a Level 1 complaint is escalated, the new Level 2 complaint
            // stores a reference back to the original
            $table->uuid('escalated_from_id')->nullable()->after('complaint_type');
            $table->foreign('escalated_from_id')->references('id')->on('complaints')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->dropForeign(['escalated_from_id']);
            $table->dropColumn(['level', 'complaint_type', 'escalated_from_id']);
        });
    }
};
