<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('research_output_id', 36);
            $table->string('patent_number', 200)->nullable();
            $table->string('jurisdiction', 100)->nullable();
            $table->date('filing_date')->nullable();
            $table->date('grant_date')->nullable();
            $table->string('status', 30)->default('filed');
            $table->text('technical_specs')->nullable();
            $table->string('file_path', 500)->nullable();
            $table->timestamps();

            $table->foreign('research_output_id')->references('id')->on('research_outputs');
        });

        DB::statement("ALTER TABLE patents ADD CONSTRAINT chk_patent_status CHECK (status IN ('filed','granted','rejected','pending'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('patents');
    }
};
