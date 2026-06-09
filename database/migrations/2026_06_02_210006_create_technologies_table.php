<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('technologies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('research_output_id', 36);
            $table->string('version', 50)->nullable();
            $table->string('repository_url', 500)->nullable();
            $table->string('license', 100)->nullable();
            $table->string('demo_url', 500)->nullable();
            $table->text('technical_specs')->nullable();
            $table->string('file_path', 500)->nullable();
            $table->timestamps();

            $table->foreign('research_output_id')->references('id')->on('research_outputs');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('technologies');
    }
};
