<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ef_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained('ef_applications')->cascadeOnDelete();
            $table->foreignUuid('reviewer_id')->constrained('users');
            $table->enum('stage', ['department', 'college', 'research_office', 'management'])->default('department');
            $table->enum('status', ['pending', 'approved', 'rejected', 'revision_required'])->default('pending');
            $table->text('comments')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['application_id', 'stage']);
            $table->unique(['application_id', 'reviewer_id', 'stage']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ef_reviews');
    }
};
