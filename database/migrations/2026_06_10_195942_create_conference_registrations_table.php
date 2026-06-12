<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conference_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained('conferences')->cascadeOnDelete();
            $table->string('name');
            $table->string('email');
            $table->string('organization')->nullable();
            $table->string('phone')->nullable();
            $table->enum('status', ['pending', 'confirmed', 'cancelled'])->default('confirmed');
            $table->timestamp('registered_at')->useCurrent();
            $table->timestamps();

            $table->unique(['conference_id', 'email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conference_registrations');
    }
};
