<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each college's share of a call's funding budget, set by the central office.
     * College RTT Managers fund their college's proposals within that share.
     */
    public function up(): void
    {
        Schema::create('call_college_budgets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('proposal_call_id')->constrained('proposal_calls')->cascadeOnDelete();
            $table->foreignUuid('college_id')->constrained('colleges')->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->foreignUuid('set_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['proposal_call_id', 'college_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_college_budgets');
    }
};
