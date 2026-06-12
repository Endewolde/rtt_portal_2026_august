<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conference_abstract_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('abstract_id')->constrained('conference_abstracts')->cascadeOnDelete();
            $table->foreignUuid('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('score')->nullable()->comment('1-10');
            $table->text('comments')->nullable();
            $table->enum('recommendation', ['accept', 'reject', 'revise'])->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['abstract_id', 'reviewer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conference_abstract_reviews');
    }
};
