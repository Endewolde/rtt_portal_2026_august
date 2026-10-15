<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** A reviewer's acceptance of the confidentiality agreement for one academic year. */
    public function up(): void
    {
        Schema::create('reviewer_agreements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('academic_year', 20);
            $table->text('agreement_text');
            $table->timestamp('accepted_at');
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'academic_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviewer_agreements');
    }
};
