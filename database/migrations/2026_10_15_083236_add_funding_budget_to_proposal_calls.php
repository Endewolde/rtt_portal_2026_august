<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** The total money available to fund proposals from this call (null = not set). */
    public function up(): void
    {
        Schema::table('proposal_calls', function (Blueprint $table) {
            $table->decimal('funding_budget', 15, 2)->nullable()->after('max_proposals_per_pi');
        });
    }

    public function down(): void
    {
        Schema::table('proposal_calls', function (Blueprint $table) {
            $table->dropColumn('funding_budget');
        });
    }
};
