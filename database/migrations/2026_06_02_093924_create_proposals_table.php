<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proposals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tracker_number', 30)->unique();
            $table->char('proposal_call_id', 36);
            $table->string('category', 50);
            $table->string('title', 500);
            $table->text('abstract')->nullable();
            $table->text('keywords')->nullable();
            $table->string('status', 60)->default('draft');
            $table->char('pi_user_id', 36);
            $table->char('college_id', 36);
            $table->char('department_id', 36);
            $table->string('academic_year', 20);
            $table->tinyInteger('current_wizard_step')->default(1);
            $table->json('wizard_completed_steps')->nullable();
            $table->json('draft_data')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->char('created_by', 36);
            $table->softDeletes();
            $table->timestamps();

            $table->index('status');
            $table->index('pi_user_id');
            $table->index('college_id');
            $table->index(['category', 'academic_year']);
            $table->fullText(['title', 'abstract', 'keywords']);
            $table->foreign('proposal_call_id')->references('id')->on('proposal_calls');
            $table->foreign('pi_user_id')->references('id')->on('users');
            $table->foreign('college_id')->references('id')->on('colleges');
            $table->foreign('department_id')->references('id')->on('departments');
            $table->foreign('created_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposals');
    }
};
