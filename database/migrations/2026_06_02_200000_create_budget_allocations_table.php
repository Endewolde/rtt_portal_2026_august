<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_allocations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('college_id', 36);
            $table->char('proposal_id', 36)->nullable();
            $table->string('fiscal_year', 20);
            $table->decimal('total_amount', 15, 2);
            $table->decimal('allocated_amount', 15, 2)->default(0);
            $table->decimal('remaining_balance', 15, 2);
            $table->string('allocation_type', 50)->default('college');
            $table->char('allocated_by', 36);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['college_id', 'fiscal_year']);
            $table->index('proposal_id');
            $table->foreign('college_id')->references('id')->on('colleges');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('allocated_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE budget_allocations ADD CONSTRAINT chk_alloc_type CHECK (allocation_type IN ('college','proposal'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_allocations');
    }
};
