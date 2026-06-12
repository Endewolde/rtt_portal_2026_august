<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conference_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained('conferences')->cascadeOnDelete();
            $table->string('track')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->string('room')->nullable();
            $table->enum('type', ['keynote', 'talk', 'workshop', 'panel', 'break', 'other'])->default('talk');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('conference_sessions');
    }
};
