<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proposal_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->char('user_id', 36);
            $table->string('role', 50);
            $table->decimal('contribution_percentage', 5, 2)->default(0);
            $table->string('status', 20)->default('active');
            $table->text('withdrawal_reason')->nullable();
            $table->timestamp('withdrawn_at')->nullable();
            $table->timestamp('joined_at');
            $table->timestamps();

            $table->index('proposal_id');
            $table->index('user_id');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('user_id')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_members');
    }
};
