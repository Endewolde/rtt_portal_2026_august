<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_settlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('budget_request_id', 36)->unique();
            $table->char('submitted_by', 36);
            $table->string('status', 30)->default('submitted');
            $table->string('expense_report_path', 500)->nullable();
            $table->decimal('total_spent', 15, 2)->nullable();
            $table->decimal('unspent_amount', 15, 2)->nullable();
            $table->char('college_verified_by', 36)->nullable();
            $table->timestamp('college_verified_at')->nullable();
            $table->text('college_notes')->nullable();
            $table->char('finance_verified_by', 36)->nullable();
            $table->timestamp('finance_verified_at')->nullable();
            $table->text('finance_notes')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->foreign('budget_request_id')->references('id')->on('budget_requests');
            $table->foreign('submitted_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE budget_settlements ADD CONSTRAINT chk_settlement_status CHECK (status IN ('submitted','college_verified','finance_verified'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_settlements');
    }
};
