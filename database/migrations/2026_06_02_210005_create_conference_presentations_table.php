<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conference_presentations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('research_output_id', 36);
            $table->string('conference_name', 300);
            $table->string('location', 200)->nullable();
            $table->date('presentation_date')->nullable();
            $table->string('proceedings_isbn', 50)->nullable();
            $table->string('doi', 200)->nullable();
            $table->string('file_path', 500)->nullable();
            $table->timestamps();

            $table->foreign('research_output_id')->references('id')->on('research_outputs');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conference_presentations');
    }
};
