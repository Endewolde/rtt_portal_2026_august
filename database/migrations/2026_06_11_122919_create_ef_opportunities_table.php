<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ef_opportunities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('agency_id')->constrained('ef_agencies')->cascadeOnDelete();
            $table->string('title');
            $table->string('ref_number')->nullable();
            $table->enum('category', ['research', 'community_engagement', 'technology_transfer', 'innovation', 'other'])->default('research');
            $table->enum('type', ['grant', 'contract', 'fellowship', 'scholarship', 'other'])->default('grant');
            $table->text('description')->nullable();
            $table->text('eligibility')->nullable();
            $table->decimal('amount_min', 15, 2)->nullable();
            $table->decimal('amount_max', 15, 2)->nullable();
            $table->string('currency', 10)->default('USD');
            $table->date('opening_date')->nullable();
            $table->date('deadline')->nullable();
            $table->date('expected_notification_date')->nullable();
            $table->json('keywords')->nullable();
            $table->enum('status', ['draft', 'open', 'closed', 'cancelled'])->default('draft');
            $table->boolean('is_featured')->default(false);
            $table->foreignUuid('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['agency_id', 'status']);
            $table->index('deadline');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ef_opportunities');
    }
};
