<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_transitions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('from_stage_id', 36);
            $table->char('action_id', 36);
            $table->char('to_stage_id', 36);
            $table->json('allowed_roles');
            $table->string('guard_class', 200)->nullable();
            $table->timestamps();

            $table->unique(['from_stage_id', 'action_id']);
            $table->foreign('from_stage_id')->references('id')->on('workflow_stages');
            $table->foreign('action_id')->references('id')->on('workflow_actions');
            $table->foreign('to_stage_id')->references('id')->on('workflow_stages');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_transitions');
    }
};
