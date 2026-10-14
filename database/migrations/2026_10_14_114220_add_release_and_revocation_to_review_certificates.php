<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Certificates are issued when the central office releases an academic year (the
     * rules in force are kept with the release), and can be revoked afterwards.
     */
    public function up(): void
    {
        Schema::create('review_certificate_releases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('academic_year', 20)->unique();
            $table->unsignedSmallInteger('min_reviews');
            $table->boolean('on_time_only')->default(false);
            $table->unsignedInteger('certificates_issued')->default(0);
            $table->foreignUuid('released_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('released_at');
            $table->timestamps();
        });

        Schema::table('review_certificates', function (Blueprint $table) {
            $table->timestamp('revoked_at')->nullable()->after('issued_at');
            $table->foreignUuid('revoked_by')->nullable()->after('revoked_at')->constrained('users')->nullOnDelete();
            $table->text('revocation_reason')->nullable()->after('revoked_by');
        });
    }

    public function down(): void
    {
        Schema::table('review_certificates', function (Blueprint $table) {
            $table->dropConstrainedForeignId('revoked_by');
            $table->dropColumn(['revoked_at', 'revocation_reason']);
        });

        Schema::dropIfExists('review_certificate_releases');
    }
};
