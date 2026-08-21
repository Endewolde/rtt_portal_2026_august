<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('review_assignment_id', 36);
            $table->string('type', 30);
            $table->timestamp('sent_at');
            $table->char('sent_by', 36)->nullable();
            $table->timestamps();

            $table->foreign('review_assignment_id')->references('id')->on('review_assignments')->cascadeOnDelete();
            $table->foreign('sent_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['review_assignment_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_reminders');
    }
};
