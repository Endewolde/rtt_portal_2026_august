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
        Schema::create('budget_revision_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('proposal_id');
            $table->uuid('requested_by');
            $table->text('reason');
            $table->decimal('current_total', 12, 2);
            $table->decimal('requested_total', 12, 2);
            $table->json('requested_items');
            $table->enum('status', ['pending', 'approved', 'denied'])->default('pending');
            $table->uuid('resolved_by')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->foreign('proposal_id')->references('id')->on('proposals')->cascadeOnDelete();
            $table->foreign('requested_by')->references('id')->on('users');
            $table->foreign('resolved_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budget_revision_requests');
    }
};
