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
        Schema::create('deadline_extension_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('proposal_id');
            $table->uuid('requested_by');
            $table->text('reason');
            $table->timestamp('requested_until');
            $table->enum('status', ['pending', 'approved', 'denied'])->default('pending');
            $table->uuid('resolved_by')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamp('granted_until')->nullable();
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
        Schema::dropIfExists('deadline_extension_requests');
    }
};
