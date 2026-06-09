<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_sections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('form_template_id', 36);
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->smallInteger('order_index')->default(0);
            $table->timestamps();

            $table->index('form_template_id');
            $table->foreign('form_template_id')->references('id')->on('form_templates');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_sections');
    }
};
