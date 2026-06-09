<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('event_type', 100);
            $table->char('actor_id', 36)->nullable();
            $table->string('entity_type', 100)->nullable();
            $table->char('entity_id', 36)->nullable();
            $table->json('data')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('event_type');
            $table->index('actor_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
