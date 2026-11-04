<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Conference review done the way international calls run it: tracks to route abstracts,
 * a weighted scoring rubric, blind review by default, conflicts of interest declared,
 * and authors recorded properly (affiliation, country, ORCID, who presents).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conferences', function (Blueprint $table) {
            // double_blind: reviewers don't see who wrote it; single_blind: they do; open: both see each other.
            $table->string('review_mode', 20)->default('double_blind')->after('abstract_deadline');
        });

        Schema::create('conference_tracks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained()->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('description', 500)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('conference_review_criteria', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained()->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('description', 500)->nullable();
            $table->unsignedTinyInteger('weight')->default(1);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('conference_abstracts', function (Blueprint $table) {
            $table->foreignUuid('track_id')->nullable()->after('conference_id')->constrained('conference_tracks')->nullOnDelete();
            $table->string('submitter_orcid', 19)->nullable()->after('submitter_affiliation');
            $table->string('submitter_country', 80)->nullable()->after('submitter_orcid');
            $table->boolean('submitter_presenting')->default(true)->after('submitter_country');
        });

        Schema::table('conference_abstract_reviews', function (Blueprint $table) {
            $table->json('criteria_scores')->nullable()->after('score');
            $table->text('confidential_comments')->nullable()->after('comments');
            $table->timestamp('conflict_declared_at')->nullable()->after('submitted_at');
            $table->string('conflict_reason', 1000)->nullable()->after('conflict_declared_at');
        });
    }

    public function down(): void
    {
        Schema::table('conference_abstract_reviews', function (Blueprint $table) {
            $table->dropColumn(['criteria_scores', 'confidential_comments', 'conflict_declared_at', 'conflict_reason']);
        });
        Schema::table('conference_abstracts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('track_id');
            $table->dropColumn(['submitter_orcid', 'submitter_country', 'submitter_presenting']);
        });
        Schema::dropIfExists('conference_review_criteria');
        Schema::dropIfExists('conference_tracks');
        Schema::table('conferences', function (Blueprint $table) {
            $table->dropColumn('review_mode');
        });
    }
};
