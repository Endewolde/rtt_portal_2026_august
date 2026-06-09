<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('complaints', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->char('complainant_id', 36);
            $table->string('stage', 50);
            $table->text('description');
            $table->string('status', 30)->default('open');
            $table->char('assigned_to', 36)->nullable();
            $table->text('response')->nullable();
            $table->char('resolved_by', 36)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index('proposal_id');
            $table->index('status');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('complainant_id')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('complaints');
    }
};
