<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Second opinions on blind reviews. A reviewer invited because the first reviewers
     * disagreed is marked is_second_opinion. Once they submit, the two closest scores
     * decide; the furthest is set aside — kept on record, but not counted in the blind
     * review score.
     */
    public function up(): void
    {
        Schema::table('review_assignments', function (Blueprint $table) {
            $table->boolean('is_second_opinion')->default(false)->after('status');
            $table->timestamp('set_aside_at')->nullable()->after('is_second_opinion');
        });
    }

    public function down(): void
    {
        Schema::table('review_assignments', function (Blueprint $table) {
            $table->dropColumn(['is_second_opinion', 'set_aside_at']);
        });
    }
};
