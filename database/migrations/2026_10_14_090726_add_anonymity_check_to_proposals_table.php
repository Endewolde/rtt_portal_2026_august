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
        Schema::table('proposals', function (Blueprint $table) {
            // clean | issues | not_checked — see App\Services\AnonymityCheckService.
            $table->string('anonymity_status', 20)->nullable()->after('rejection_reason');
            $table->json('anonymity_findings')->nullable()->after('anonymity_status');
            $table->timestamp('anonymity_checked_at')->nullable()->after('anonymity_findings');
            $table->index('anonymity_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropIndex(['anonymity_status']);
            $table->dropColumn(['anonymity_status', 'anonymity_findings', 'anonymity_checked_at']);
        });
    }
};
