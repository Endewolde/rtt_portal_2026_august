<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->char('reviewer_id', 36);
            $table->char('evaluation_type_id', 36);
            $table->char('assigned_by', 36);
            $table->string('status', 30)->default('pending');
            $table->timestamp('assigned_at');
            $table->date('due_date')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->boolean('is_external')->default(false);
            $table->timestamps();

            $table->unique(['proposal_id', 'reviewer_id', 'evaluation_type_id'], 'ra_proposal_reviewer_type_unique');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('reviewer_id')->references('id')->on('users');
            $table->foreign('evaluation_type_id')->references('id')->on('evaluation_types');
            $table->foreign('assigned_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_assignments');
    }
};
