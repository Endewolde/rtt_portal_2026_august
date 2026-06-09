<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluation_questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('evaluation_category_id', 36);
            $table->text('question_text');
            $table->tinyInteger('max_score')->default(5);
            $table->decimal('weight', 5, 2)->default(1.00);
            $table->boolean('is_required')->default(true);
            $table->smallInteger('order_index')->default(0);
            $table->timestamps();

            $table->foreign('evaluation_category_id')->references('id')->on('evaluation_categories');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluation_questions');
    }
};
