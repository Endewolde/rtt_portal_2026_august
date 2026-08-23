<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proposal_approval_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('proposal_id', 36);
            $table->char('reported_by', 36);
            $table->text('reason');
            $table->string('status', 20)->default('open');
            $table->char('reviewed_by', 36)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();

            $table->index('proposal_id');
            $table->index('status');
            $table->foreign('proposal_id')->references('id')->on('proposals');
            $table->foreign('reported_by')->references('id')->on('users');
            $table->foreign('reviewed_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE proposal_approval_reports ADD CONSTRAINT chk_par_status CHECK (status IN ('open','reviewed'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_approval_reports');
    }
};
