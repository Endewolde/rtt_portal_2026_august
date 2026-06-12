<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conference_abstracts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained('conferences')->cascadeOnDelete();
            $table->string('submitter_name');
            $table->string('submitter_email');
            $table->string('submitter_affiliation')->nullable();
            $table->json('co_authors')->nullable();
            $table->string('title');
            $table->text('body');
            $table->json('keywords')->nullable();
            $table->enum('presentation_type', ['oral', 'poster', 'workshop', 'panel', 'other'])->default('oral');
            $table->string('file_path')->nullable();
            $table->unsignedInteger('word_count')->nullable();
            $table->enum('status', ['draft', 'submitted', 'under_review', 'revision_requested', 'accepted', 'rejected', 'withdrawn'])->default('draft');
            $table->string('submission_token')->unique();
            $table->timestamp('submitted_at')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamps();

            $table->index(['conference_id', 'status']);
            $table->index('submitter_email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conference_abstracts');
    }
};
