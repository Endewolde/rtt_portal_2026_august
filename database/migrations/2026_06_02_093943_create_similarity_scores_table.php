<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('similarity_scores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->char('similar_proposal_id', 36);
            $table->decimal('score', 5, 4);
            $table->boolean('flagged')->default(false);
            $table->timestamp('checked_at');
            $table->timestamps();

            $table->index('proposal_id');
            $table->index('flagged');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('similar_proposal_id')->references('id')->on('proposals');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('similarity_scores');
    }
};
