<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Funding rounds: the central office decides a call's proposals together — fund,
     * reserve or reject, as drafts nobody is told about — then publishes them all at
     * once. A published round is the record of the decision (and its minutes).
     */
    public function up(): void
    {
        Schema::create('funding_rounds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('proposal_call_id')->constrained('proposal_calls')->cascadeOnDelete();
            $table->string('status', 20)->default('draft'); // draft | published
            $table->text('notes')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->decimal('budget_at_publish', 15, 2)->nullable();
            $table->decimal('committed_before', 15, 2)->nullable();
            $table->timestamps();

            $table->index(['proposal_call_id', 'status']);
        });

        Schema::create('funding_round_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('funding_round_id')->constrained('funding_rounds')->cascadeOnDelete();
            $table->foreignUuid('proposal_id')->constrained('proposals')->cascadeOnDelete();
            $table->string('decision', 20)->default('pending'); // pending | fund | reserve | reject
            $table->decimal('amount', 15, 2)->nullable();
            $table->string('reason_code', 50)->nullable();
            $table->text('reason')->nullable();
            $table->text('remarks')->nullable();
            $table->unsignedSmallInteger('rank')->nullable();
            $table->decimal('score', 8, 2)->nullable();
            $table->decimal('score_max', 8, 2)->nullable();
            $table->decimal('requested', 15, 2)->nullable();
            $table->timestamp('promoted_at')->nullable();
            $table->timestamps();

            $table->unique(['funding_round_id', 'proposal_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('funding_round_items');
        Schema::dropIfExists('funding_rounds');
    }
};
