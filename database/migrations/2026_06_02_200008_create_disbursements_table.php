<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disbursements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('budget_request_id', 36);
            $table->char('disbursed_by', 36);
            $table->decimal('amount', 15, 2);
            $table->string('transaction_id', 200)->nullable();
            $table->string('cheque_number', 100)->nullable();
            $table->string('payment_proof_path', 500)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('disbursed_at');
            $table->timestamps();

            $table->index('budget_request_id');
            $table->foreign('budget_request_id')->references('id')->on('budget_requests');
            $table->foreign('disbursed_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disbursements');
    }
};
