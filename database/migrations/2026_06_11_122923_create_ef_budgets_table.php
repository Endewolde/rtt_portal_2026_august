<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ef_budgets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained('ef_applications')->cascadeOnDelete();
            $table->foreignUuid('award_id')->nullable()->constrained('ef_awards')->nullOnDelete();
            $table->enum('category', ['personnel', 'equipment', 'travel', 'overhead', 'subcontract', 'other'])->default('other');
            $table->string('description');
            $table->decimal('proposed_amount', 15, 2)->default(0);
            $table->decimal('approved_amount', 15, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('application_id');
            $table->index('award_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ef_budgets');
    }
};
