<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        // Drop unique index if it still exists from a partial previous run.
        $indexExists = DB::selectOne("
            SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'similarity_scores'
              AND INDEX_NAME = 'similarity_scores_pair_unique'
        ");
        if ($indexExists) {
            DB::statement('ALTER TABLE similarity_scores DROP INDEX similarity_scores_pair_unique');
        }

        // 1. Remove self-comparisons (proposal compared to itself — invalid data).
        DB::statement('DELETE FROM similarity_scores WHERE proposal_id = similar_proposal_id');

        // 2. For each bidirectional pair (A→B and B→A), keep only the A→B row (A < B).
        DB::statement('
            DELETE FROM similarity_scores
            WHERE proposal_id > similar_proposal_id
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT id FROM similarity_scores s2
                      WHERE s2.proposal_id  = similarity_scores.similar_proposal_id
                        AND s2.similar_proposal_id = similarity_scores.proposal_id
                  ) AS rev
              )
        ');

        // 3. Flip any remaining reversed rows (B→A where A→B does not exist).
        DB::statement('
            UPDATE similarity_scores
            SET proposal_id         = similar_proposal_id,
                similar_proposal_id = proposal_id
            WHERE proposal_id > similar_proposal_id
        ');

        // 4. Final safety dedup — keep MIN(id) per normalised pair.
        DB::statement('
            DELETE FROM similarity_scores
            WHERE id NOT IN (
                SELECT keep_id FROM (
                    SELECT MIN(id) AS keep_id
                    FROM similarity_scores
                    GROUP BY LEAST(proposal_id, similar_proposal_id),
                             GREATEST(proposal_id, similar_proposal_id)
                ) AS dedup
            )
        ');

        // 5. Re-apply unique constraint.
        DB::statement('ALTER TABLE similarity_scores ADD UNIQUE similarity_scores_pair_unique (proposal_id, similar_proposal_id)');

        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }

    public function down(): void
    {
        // Not reversible — one-way data clean-up.
    }
};
