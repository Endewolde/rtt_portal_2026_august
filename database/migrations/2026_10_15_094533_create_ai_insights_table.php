<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Saved AI advice: the writing coach's feedback for a research team, and the review
     * summary for the central committee. Advisory only — never part of scoring.
     */
    public function up(): void
    {
        Schema::create('ai_insights', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('proposal_id')->constrained('proposals')->cascadeOnDelete();
            $table->string('type', 30);
            $table->foreignUuid('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('result');
            $table->string('model', 100)->nullable();
            // What the advice was based on, so it can be flagged as out of date when that changes.
            $table->string('fingerprint', 64)->nullable();
            $table->timestamps();

            $table->index(['proposal_id', 'type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_insights');
    }
};
