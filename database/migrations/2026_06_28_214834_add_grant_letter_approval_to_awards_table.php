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
        Schema::table('awards', function (Blueprint $table) {
            $table->timestamp('grant_letter_approved_at')->nullable()->after('award_letter_path');
            $table->char('grant_letter_approved_by', 36)->nullable()->after('grant_letter_approved_at');
            $table->foreign('grant_letter_approved_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::table('awards', function (Blueprint $table) {
            $table->dropForeign(['grant_letter_approved_by']);
            $table->dropColumn(['grant_letter_approved_at', 'grant_letter_approved_by']);
        });
    }
};
