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
        Schema::table('proposal_approval_reports', function (Blueprint $table) {
            // approval_stands | approval_revoked — what the reviewing officer decided.
            $table->string('outcome', 30)->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('proposal_approval_reports', function (Blueprint $table) {
            $table->dropColumn('outcome');
        });
    }
};
