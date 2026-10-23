<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reviewer recruitment: experts outside the university apply on the public site
     * with their expertise and CV; an officer approves them into the reviewer pool,
     * which creates their external reviewer account. affiliation records where a
     * reviewer works, shown when choosing reviewers.
     */
    public function up(): void
    {
        Schema::create('reviewer_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 150);
            $table->string('title', 50)->nullable();
            $table->string('email', 191)->index();
            $table->string('phone', 30)->nullable();
            $table->string('organization', 200);
            $table->string('position', 150)->nullable();
            $table->string('qualification', 50);
            $table->json('expertise');
            $table->text('bio')->nullable();
            $table->string('orcid', 19)->nullable();
            $table->string('cv_path', 500);
            $table->string('status', 20)->default('pending')->index();
            $table->char('reviewed_by', 36)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_note')->nullable();
            $table->char('user_id', 36)->nullable();
            $table->timestamps();

            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('affiliation', 200)->nullable()->after('department_id');
        });

        // Creates reviewers.recruit for the central office, admins and directors.
        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::dropIfExists('reviewer_applications');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('affiliation');
        });
    }
};
