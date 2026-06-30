<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Remove duplicate rows before adding the unique constraint.
        // Keep one row per (proposal_id, similar_proposal_id) pair — whichever has MIN(id).
        DB::statement('
            DELETE FROM similarity_scores
            WHERE id NOT IN (
                SELECT keep_id FROM (
                    SELECT MIN(id) AS keep_id
                    FROM similarity_scores
                    GROUP BY proposal_id, similar_proposal_id
                ) AS dedup
            )
        ');

        Schema::table('similarity_scores', function (Blueprint $table) {
            $table->unique(['proposal_id', 'similar_proposal_id'], 'similarity_scores_pair_unique');
        });
    }

    public function down(): void
    {
        Schema::table('similarity_scores', function (Blueprint $table) {
            $table->dropUnique('similarity_scores_pair_unique');
        });
    }
};
