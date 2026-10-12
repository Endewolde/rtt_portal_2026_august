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
        Schema::create('defence_deadline_extensions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('defence_session_id')->constrained('defence_sessions')->cascadeOnDelete();
            $table->foreignUuid('proposal_id')->constrained('proposals');
            $table->foreignUuid('requested_by')->constrained('users');
            $table->dateTime('requested_until');
            $table->text('reason');
            $table->string('status', 20)->default('pending');
            $table->dateTime('granted_until')->nullable();
            $table->foreignUuid('decided_by')->nullable()->constrained('users');
            $table->text('decision_notes')->nullable();
            $table->dateTime('decided_at')->nullable();
            $table->timestamps();

            $table->index(['defence_session_id', 'status']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('defence_deadline_extensions');
    }
};
