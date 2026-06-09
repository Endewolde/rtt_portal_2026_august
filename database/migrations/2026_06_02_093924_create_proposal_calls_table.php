<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proposal_calls', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('academic_year', 20);
            $table->string('category', 50);
            $table->string('title', 500);
            $table->string('slug', 520)->unique();
            $table->longText('description')->nullable();
            $table->text('eligibility')->nullable();
            $table->string('guidelines_file', 500)->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 30)->default('draft');
            $table->boolean('is_open')->default(false);
            $table->smallInteger('max_proposals_per_pi')->nullable();
            $table->char('created_by', 36);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['status', 'is_open']);
            $table->index(['category', 'academic_year']);
            $table->foreign('created_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_calls');
    }
};
