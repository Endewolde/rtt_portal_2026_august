<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('budget_request_id', 36);
            $table->string('transaction_type', 50);
            $table->decimal('amount', 15, 2);
            $table->text('description')->nullable();
            $table->string('reference_number', 200)->nullable();
            $table->char('transacted_by', 36);
            $table->timestamp('transacted_at');
            $table->timestamps();

            $table->index('budget_request_id');
            $table->foreign('budget_request_id')->references('id')->on('budget_requests');
            $table->foreign('transacted_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE budget_transactions ADD CONSTRAINT chk_txn_type CHECK (transaction_type IN ('disbursement','refund','adjustment'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_transactions');
    }
};
