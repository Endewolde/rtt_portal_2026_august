<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracker_numbers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('category', 50);
            $table->string('academic_year', 20);
            $table->integer('last_sequence')->default(0);
            $table->timestamps();

            $table->unique(['category', 'academic_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracker_numbers');
    }
};
