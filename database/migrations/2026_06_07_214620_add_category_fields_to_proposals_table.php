<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            // Shared across all categories
            $table->string('focus_area', 255)->nullable()->after('keywords');
            $table->unsignedSmallInteger('duration_months')->nullable()->after('focus_area');

            // Research-only
            $table->string('research_type', 60)->nullable()->after('duration_months');
        });
    }

    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropColumn(['focus_area', 'duration_months', 'research_type']);
        });
    }
};
