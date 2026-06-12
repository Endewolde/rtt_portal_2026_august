<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conferences', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->longText('description')->nullable();
            $table->string('banner_image')->nullable();
            $table->string('thumbnail')->nullable();
            $table->timestamp('start_date');
            $table->timestamp('end_date')->nullable();
            $table->string('timezone')->default('UTC');
            $table->enum('location_type', ['physical', 'virtual', 'hybrid'])->default('physical');
            $table->text('location_address')->nullable();
            $table->string('virtual_link')->nullable();
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->timestamp('publish_at')->nullable();
            $table->unsignedInteger('max_capacity')->nullable();
            $table->string('registration_link')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->json('tags')->nullable();
            $table->foreignUuid('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conferences');
    }
};
