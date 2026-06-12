<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ef_expenditures', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('award_id')->constrained('ef_awards')->cascadeOnDelete();
            $table->foreignUuid('budget_id')->nullable()->constrained('ef_budgets')->nullOnDelete();
            $table->string('description');
            $table->decimal('amount', 15, 2);
            $table->date('expense_date');
            $table->enum('category', ['personnel', 'equipment', 'travel', 'overhead', 'subcontract', 'other'])->default('other');
            $table->string('receipt_path')->nullable();
            $table->foreignUuid('recorded_by')->constrained('users');
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('award_id');
            $table->index('expense_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ef_expenditures');
    }
};
