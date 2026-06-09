<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_approvals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('budget_request_id', 36)->unique();
            $table->char('approved_by', 36);
            $table->string('approval_type', 30);
            $table->text('notes')->nullable();
            $table->timestamp('approved_at');
            $table->timestamps();

            $table->foreign('budget_request_id')->references('id')->on('budget_requests');
            $table->foreign('approved_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE budget_approvals ADD CONSTRAINT chk_approval_type CHECK (approval_type IN ('college','finance'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_approvals');
    }
};
