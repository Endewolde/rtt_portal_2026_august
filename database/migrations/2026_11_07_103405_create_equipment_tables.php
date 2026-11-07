<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('equipment', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('category', 60)->nullable();
            $table->string('asset_tag', 60)->nullable();
            $table->text('description')->nullable();
            $table->foreignUuid('college_id')->nullable()->constrained()->nullOnDelete();
            $table->string('location')->nullable();
            $table->foreignUuid('custodian_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 20)->default('available');
            $table->boolean('requires_approval')->default(true);
            $table->unsignedSmallInteger('max_booking_hours')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('equipment_bookings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('equipment_id')->constrained('equipment')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('proposal_id')->nullable()->constrained()->nullOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('purpose', 500);
            $table->string('status', 20)->default('pending');
            $table->string('decision_note', 500)->nullable();
            $table->foreignUuid('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['equipment_id', 'starts_at']);
        });

        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::dropIfExists('equipment_bookings');
        Schema::dropIfExists('equipment');
    }
};
