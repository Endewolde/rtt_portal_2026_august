<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('review_certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('academic_year', 20);
            $table->unsignedSmallInteger('blind_reviews')->default(0);
            $table->unsignedSmallInteger('defence_reviews')->default(0);
            // Public verification code printed on the certificate.
            $table->string('code', 16)->unique();
            $table->timestamp('issued_at');
            $table->timestamps();

            $table->unique(['user_id', 'academic_year']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('review_certificates');
    }
};
