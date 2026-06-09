<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('research_output_id', 36);
            $table->string('doi', 200)->nullable();
            $table->string('journal_name', 300)->nullable();
            $table->string('volume', 50)->nullable();
            $table->string('issue', 50)->nullable();
            $table->string('pages', 50)->nullable();
            $table->smallInteger('year')->nullable();
            $table->string('publisher', 200)->nullable();
            $table->boolean('is_scopus_indexed')->default(false);
            $table->boolean('is_wos_indexed')->default(false);
            $table->string('file_path', 500)->nullable();
            $table->timestamps();

            $table->foreign('research_output_id')->references('id')->on('research_outputs');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publications');
    }
};
