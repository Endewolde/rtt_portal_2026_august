<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conference_speakers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained('conferences')->cascadeOnDelete();
            $table->string('name');
            $table->string('title')->nullable();
            $table->text('bio')->nullable();
            $table->string('photo')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('twitter')->nullable();
            $table->string('linkedin')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('conference_session_speakers', function (Blueprint $table) {
            $table->foreignUuid('session_id')->constrained('conference_sessions')->cascadeOnDelete();
            $table->foreignUuid('speaker_id')->constrained('conference_speakers')->cascadeOnDelete();
            $table->primary(['session_id', 'speaker_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conference_session_speakers');
        Schema::dropIfExists('conference_speakers');
    }
};
