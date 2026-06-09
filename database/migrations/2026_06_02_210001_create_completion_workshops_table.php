<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('completion_workshops', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->date('scheduled_date');
            $table->time('scheduled_time');
            $table->string('venue', 300);
            $table->string('online_link', 500)->nullable();
            $table->string('status', 30)->default('scheduled');
            $table->char('scheduled_by', 36);
            $table->decimal('final_score', 5, 2)->nullable();
            $table->text('evaluator_remarks')->nullable();
            $table->json('presentation_files')->nullable();
            $table->json('photos')->nullable();
            $table->json('videos')->nullable();
            $table->string('final_report_path', 500)->nullable();
            $table->timestamps();

            $table->index('proposal_id');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('scheduled_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE completion_workshops ADD CONSTRAINT chk_cw_status CHECK (status IN ('scheduled','completed','cancelled','postponed'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('completion_workshops');
    }
};
