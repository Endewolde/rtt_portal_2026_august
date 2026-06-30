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
        Schema::create('proposal_ai_scores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36)->unique();
            $table->unsignedTinyInteger('clarity_score')->nullable();
            $table->unsignedTinyInteger('feasibility_score')->nullable();
            $table->unsignedTinyInteger('budget_alignment_score')->nullable();
            $table->unsignedTinyInteger('innovation_score')->nullable();
            $table->unsignedTinyInteger('completeness_score')->nullable();
            $table->unsignedTinyInteger('overall_score')->nullable();
            $table->text('strengths')->nullable();
            $table->text('weaknesses')->nullable();
            $table->text('recommendations')->nullable();
            $table->text('summary')->nullable();
            $table->string('model_used', 100)->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamp('scored_at')->nullable();
            $table->timestamps();

            $table->foreign('proposal_id')->references('id')->on('proposals')->cascadeOnDelete();
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('proposal_ai_scores');
    }
};
