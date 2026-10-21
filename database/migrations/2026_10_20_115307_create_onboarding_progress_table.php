<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per user and role: whether they've seen the welcome, which guided
     * tours and checklist tasks they've finished, and where an interrupted tour
     * should resume.
     */
    public function up(): void
    {
        Schema::create('onboarding_progress', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 50);
            $table->timestamp('welcome_seen_at')->nullable();
            $table->timestamp('dismissed_at')->nullable();
            $table->json('completed_tours')->nullable();
            $table->json('completed_tasks')->nullable();
            $table->string('active_tour', 80)->nullable();
            $table->unsignedSmallInteger('active_step')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('onboarding_progress');
    }
};
