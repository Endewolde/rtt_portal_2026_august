<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ef_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->constrained('ef_agencies')->cascadeOnDelete();
            $table->foreignUuid('opportunity_id')->nullable()->constrained('ef_opportunities')->nullOnDelete();
            $table->foreignUuid('college_id')->nullable()->constrained('colleges')->nullOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignUuid('pi_user_id')->constrained('users');
            $table->string('ref_number')->unique();
            $table->string('title');
            $table->enum('category', ['research', 'community_engagement', 'technology_transfer', 'innovation', 'other'])->default('research');
            $table->text('abstract')->nullable();
            $table->enum('status', [
                'draft',
                'under_internal_review',
                'approved_for_submission',
                'submitted',
                'under_review',
                'awarded',
                'rejected',
                'withdrawn',
            ])->default('draft');
            $table->decimal('amount_requested', 15, 2)->nullable();
            $table->string('currency', 10)->default('USD');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->json('keywords')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignUuid('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['status', 'created_by']);
            $table->index('agency_id');
            $table->index('pi_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ef_applications');
    }
};
