<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('defence_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->date('scheduled_date');
            $table->time('scheduled_time');
            $table->string('venue', 300);
            $table->string('online_link', 500)->nullable();
            $table->string('status', 30)->default('scheduled');
            $table->char('scheduled_by', 36);
            $table->decimal('final_score', 5, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('scheduled_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('defence_sessions');
    }
};
