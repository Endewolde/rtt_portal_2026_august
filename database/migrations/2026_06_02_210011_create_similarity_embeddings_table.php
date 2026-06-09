<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('similarity_embeddings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36)->unique();
            $table->json('embedding')->nullable();
            $table->string('model_version', 50)->nullable();
            $table->timestamps();

            $table->foreign('proposal_id')->references('id')->on('proposals');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('similarity_embeddings');
    }
};
