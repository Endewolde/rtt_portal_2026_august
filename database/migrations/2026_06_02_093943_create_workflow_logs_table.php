<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->string('from_stage', 60);
            $table->string('action', 60);
            $table->string('to_stage', 60);
            $table->char('actor_id', 36);
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('proposal_id');
            $table->index('actor_id');
            $table->index('created_at');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('actor_id')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_logs');
    }
};
