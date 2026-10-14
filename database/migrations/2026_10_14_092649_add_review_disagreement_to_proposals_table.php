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
            // Blind reviewers disagreed too much for an automatic decision — see
            // ReviewScoreService::blindDisagreement().
            $table->json('review_disagreement')->nullable()->after('anonymity_checked_at');
            $table->timestamp('review_disagreement_flagged_at')->nullable()->after('review_disagreement');
            $table->timestamp('review_disagreement_resolved_at')->nullable()->after('review_disagreement_flagged_at');
            $table->char('review_disagreement_resolved_by', 36)->nullable()->after('review_disagreement_resolved_at');
            $table->text('review_disagreement_note')->nullable()->after('review_disagreement_resolved_by');
            $table->index('review_disagreement_flagged_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropIndex(['review_disagreement_flagged_at']);
            $table->dropColumn([
                'review_disagreement', 'review_disagreement_flagged_at', 'review_disagreement_resolved_at',
                'review_disagreement_resolved_by', 'review_disagreement_note',
            ]);
        });
    }
};
