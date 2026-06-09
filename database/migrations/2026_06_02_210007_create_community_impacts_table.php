<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('community_impacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('research_output_id', 36);
            $table->integer('beneficiary_count')->nullable();
            $table->string('location', 300)->nullable();
            $table->string('impact_category', 100)->nullable();
            $table->string('evidence_file_path', 500)->nullable();
            $table->timestamps();

            $table->foreign('research_output_id')->references('id')->on('research_outputs');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_impacts');
    }
};
