<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ef_milestones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('award_id')->constrained('ef_awards')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('due_date');
            $table->timestamp('completed_at')->nullable();
            $table->enum('status', ['pending', 'in_progress', 'completed', 'overdue'])->default('pending');
            $table->timestamps();

            $table->index(['award_id', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ef_milestones');
    }
};
