<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_request_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('budget_request_id', 36);
            $table->string('category', 100);
            $table->text('description');
            $table->decimal('amount', 15, 2);
            $table->text('justification')->nullable();
            $table->timestamps();

            $table->index('budget_request_id');
            $table->foreign('budget_request_id')->references('id')->on('budget_requests');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_request_items');
    }
};
