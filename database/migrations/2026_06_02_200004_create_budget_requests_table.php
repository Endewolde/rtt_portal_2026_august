<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->char('form_template_id', 36);
            $table->char('requested_by', 36);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->string('status', 50)->default('draft');
            $table->smallInteger('funding_round')->default(1);
            $table->boolean('all_signatures_complete')->default(false);
            $table->text('college_review_notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['proposal_id', 'funding_round']);
            $table->index('status');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('form_template_id')->references('id')->on('form_templates');
            $table->foreign('requested_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE budget_requests ADD CONSTRAINT chk_br_status CHECK (status IN ('draft','pending_signatures','submitted','under_college_review','approved','rejected','disbursed','settled'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_requests');
    }
};
