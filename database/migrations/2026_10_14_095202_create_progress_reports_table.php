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
        Schema::create('progress_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('proposal_id')->constrained('proposals')->cascadeOnDelete();
            $table->unsignedSmallInteger('period_number');
            $table->date('period_start');
            $table->date('period_end');
            $table->date('due_date');
            $table->boolean('is_final')->default(false);
            // due | submitted | accepted | revision_requested
            $table->string('status', 20)->default('due');
            $table->text('summary')->nullable();
            $table->text('achievements')->nullable();
            $table->text('challenges')->nullable();
            $table->text('next_steps')->nullable();
            $table->unsignedTinyInteger('percent_complete')->nullable();
            $table->decimal('budget_spent', 15, 2)->nullable();
            $table->json('milestone_updates')->nullable();
            $table->string('attachment_path', 500)->nullable();
            $table->string('attachment_name')->nullable();
            $table->foreignUuid('submitted_by')->nullable()->constrained('users');
            $table->timestamp('submitted_at')->nullable();
            $table->foreignUuid('reviewed_by')->nullable()->constrained('users');
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamp('due_reminder_sent_at')->nullable();
            $table->timestamp('overdue_reminder_sent_at')->nullable();
            $table->timestamps();

            $table->unique(['proposal_id', 'period_number']);
            $table->index(['status', 'due_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('progress_reports');
    }
};
