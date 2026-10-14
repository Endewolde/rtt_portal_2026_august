<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** A snapshot of the proposal each time it is submitted, so resubmissions show what changed. */
    public function up(): void
    {
        Schema::create('proposal_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('proposal_id')->constrained('proposals')->cascadeOnDelete();
            $table->unsignedSmallInteger('version_number');
            $table->foreignUuid('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at');
            $table->json('snapshot');
            $table->timestamps();

            $table->unique(['proposal_id', 'version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_versions');
    }
};
