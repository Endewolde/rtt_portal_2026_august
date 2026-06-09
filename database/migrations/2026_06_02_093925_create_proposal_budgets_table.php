<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proposal_budgets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->string('category', 100);
            $table->text('item_description');
            $table->decimal('amount', 15, 2);
            $table->text('justification')->nullable();
            $table->timestamps();

            $table->index('proposal_id');
            $table->foreign('proposal_id')->references('id')->on('proposals');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_budgets');
    }
};
