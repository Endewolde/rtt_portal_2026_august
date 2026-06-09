<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('research_outputs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->string('output_type', 50);
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->char('recorded_by', 36);
            $table->timestamps();

            $table->index('proposal_id');
            $table->index('output_type');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('recorded_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE research_outputs ADD CONSTRAINT chk_ro_type CHECK (output_type IN ('journal_article','conference_paper','book','patent','software','prototype','community_impact','technology_transfer'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('research_outputs');
    }
};
