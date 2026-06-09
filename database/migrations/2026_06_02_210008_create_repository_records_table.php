<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repository_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36)->unique();
            $table->string('title', 500);
            $table->text('abstract')->nullable();
            $table->text('keywords')->nullable();
            $table->string('category', 50);
            $table->char('college_id', 36);
            $table->string('pi_name', 200);
            $table->string('academic_year', 20);
            $table->string('status', 30)->default('published');
            $table->smallInteger('total_outputs')->default(0);
            $table->smallInteger('publications_count')->default(0);
            $table->smallInteger('patents_count')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->timestamps();

            $table->index('category');
            $table->index('college_id');
            $table->index('academic_year');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('college_id')->references('id')->on('colleges');
        });

        DB::statement('ALTER TABLE repository_records ADD FULLTEXT INDEX ft_repository (title, abstract, keywords)');
    }

    public function down(): void
    {
        Schema::dropIfExists('repository_records');
    }
};
