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
            $table->index(['status', 'college_id'],    'proposals_status_college_idx');
            $table->index(['pi_user_id', 'status'],    'proposals_pi_status_idx');
            $table->index(['status', 'academic_year'], 'proposals_status_year_idx');
        });

        Schema::table('review_assignments', function (Blueprint $table) {
            $table->index(['reviewer_id', 'status'], 'review_assignments_reviewer_status_idx');
            $table->index(['proposal_id', 'status'], 'review_assignments_proposal_status_idx');
        });

        Schema::table('budget_requests', function (Blueprint $table) {
            $table->index(['proposal_id', 'status'], 'budget_requests_proposal_status_idx');
        });

        Schema::table('form_signatures', function (Blueprint $table) {
            $table->index(['budget_request_id', 'status'], 'form_signatures_request_status_idx');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['notifiable_id', 'read_at'], 'notifications_notifiable_read_idx');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index(['actor_id', 'created_at'], 'audit_logs_actor_created_idx');
        });

        Schema::table('workflow_logs', function (Blueprint $table) {
            $table->index(['proposal_id', 'created_at'], 'workflow_logs_proposal_created_idx');
        });

        Schema::table('similarity_scores', function (Blueprint $table) {
            $table->index(['proposal_id', 'flagged'], 'similarity_scores_proposal_flagged_idx');
        });
    }

    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropIndex('proposals_status_college_idx');
            $table->dropIndex('proposals_pi_status_idx');
            $table->dropIndex('proposals_status_year_idx');
        });

        Schema::table('review_assignments', function (Blueprint $table) {
            $table->dropIndex('review_assignments_reviewer_status_idx');
            $table->dropIndex('review_assignments_proposal_status_idx');
        });

        Schema::table('budget_requests', function (Blueprint $table) {
            $table->dropIndex('budget_requests_proposal_status_idx');
        });

        Schema::table('form_signatures', function (Blueprint $table) {
            $table->dropIndex('form_signatures_request_status_idx');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_notifiable_read_idx');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_actor_created_idx');
        });

        Schema::table('workflow_logs', function (Blueprint $table) {
            $table->dropIndex('workflow_logs_proposal_created_idx');
        });

        Schema::table('similarity_scores', function (Blueprint $table) {
            $table->dropIndex('similarity_scores_proposal_flagged_idx');
        });
    }
};
