<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_scores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('review_assignment_id', 36);
            $table->char('evaluation_question_id', 36);
            $table->tinyInteger('score');
            $table->text('comment')->nullable();
            $table->string('recommendation', 50)->nullable();
            $table->timestamps();

            $table->unique(['review_assignment_id', 'evaluation_question_id']);
            $table->foreign('review_assignment_id')->references('id')->on('review_assignments');
            $table->foreign('evaluation_question_id')->references('id')->on('evaluation_questions');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_scores');
    }
};
