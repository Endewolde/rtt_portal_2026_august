<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluation_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('evaluation_type_id', 36);
            $table->string('name', 200);
            $table->text('description')->nullable();
            $table->smallInteger('order_index')->default(0);
            $table->decimal('weight', 5, 2)->default(1.00);
            $table->timestamps();

            $table->foreign('evaluation_type_id')->references('id')->on('evaluation_types');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluation_categories');
    }
};
