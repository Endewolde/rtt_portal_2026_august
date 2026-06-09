<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('college_id', 36);
            $table->string('name', 200);
            $table->string('code', 20);
            $table->string('status', 20)->default('active');
            $table->softDeletes();
            $table->timestamps();

            $table->index('college_id');
            $table->foreign('college_id')->references('id')->on('colleges');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('departments');
    }
};
