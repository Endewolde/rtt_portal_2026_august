<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('awards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36)->unique();
            $table->string('grant_reference', 50)->unique();
            $table->string('award_letter_path', 500)->nullable();
            $table->string('budget_approval_path', 500)->nullable();
            $table->text('approval_notes')->nullable();
            $table->char('approved_by', 36);
            $table->timestamp('approved_at');
            $table->decimal('awarded_amount', 15, 2)->nullable();
            $table->timestamps();

            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('approved_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('awards');
    }
};
