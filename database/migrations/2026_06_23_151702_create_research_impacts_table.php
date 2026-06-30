<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('research_impacts');
        Schema::create('research_impacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('proposal_id')->constrained('proposals')->cascadeOnDelete();
            $table->foreignUuid('recorded_by')->constrained('users')->cascadeOnDelete();

            // Type: publication | patent | citation | award | conference | technology | other
            $table->string('type', 50);
            $table->string('title');
            $table->text('authors')->nullable();
            $table->string('journal_or_venue')->nullable();
            $table->year('year')->nullable();
            $table->string('doi_or_url')->nullable();
            $table->string('impact_factor')->nullable(); // e.g. "Q1", "3.4"
            $table->text('description')->nullable();
            $table->json('metadata')->nullable(); // flexible extra fields

            $table->timestamps();

            $table->index(['proposal_id', 'type']);
            $table->index('year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('research_impacts');
    }
};
