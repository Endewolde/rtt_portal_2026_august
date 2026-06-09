<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('report_type', 100);
            $table->json('filters')->nullable();
            $table->string('status', 20)->default('processing');
            $table->json('result')->nullable();
            $table->string('file_path', 500)->nullable();
            $table->string('file_format', 10)->nullable();
            $table->char('requested_by', 36);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['requested_by', 'status']);
            $table->foreign('requested_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE report_snapshots ADD CONSTRAINT chk_rs_status CHECK (status IN ('processing','ready','failed'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('report_snapshots');
    }
};
