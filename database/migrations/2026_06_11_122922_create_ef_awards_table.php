<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ef_awards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained('ef_applications')->cascadeOnDelete();
            $table->foreignUuid('agency_id')->constrained('ef_agencies');
            $table->string('award_number')->unique();
            $table->string('title');
            $table->decimal('amount_awarded', 15, 2);
            $table->string('currency', 10)->default('USD');
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('status', ['active', 'completed', 'suspended', 'terminated'])->default('active');
            $table->text('conditions')->nullable();
            $table->timestamp('signed_at')->nullable();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['status', 'agency_id']);
            $table->index('application_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ef_awards');
    }
};
