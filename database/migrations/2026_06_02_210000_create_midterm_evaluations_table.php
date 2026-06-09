<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('midterm_evaluations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->date('evaluation_date');
            $table->string('status', 30)->default('scheduled');
            $table->char('scheduled_by', 36);
            $table->text('progress_summary')->nullable();
            $table->decimal('financial_utilization_percentage', 5, 2)->nullable();
            $table->smallInteger('publications_count')->default(0);
            $table->text('challenges')->nullable();
            $table->text('milestones_achieved')->nullable();
            $table->text('milestones_missed')->nullable();
            $table->string('progress_report_path', 500)->nullable();
            $table->string('financial_report_path', 500)->nullable();
            $table->decimal('progress_score', 5, 2)->nullable();
            $table->text('college_officer_comments')->nullable();
            $table->string('recommendation', 20)->nullable();
            $table->char('scored_by', 36)->nullable();
            $table->timestamp('scored_at')->nullable();
            $table->timestamps();

            $table->index('proposal_id');
            $table->index('status');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('scheduled_by')->references('id')->on('users');
            $table->foreign('scored_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE midterm_evaluations ADD CONSTRAINT chk_me_status CHECK (status IN ('scheduled','report_submitted','scored','completed'))");
        DB::statement("ALTER TABLE midterm_evaluations ADD CONSTRAINT chk_me_recommendation CHECK (recommendation IS NULL OR recommendation IN ('continue','hold'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('midterm_evaluations');
    }
};
