<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conference_committee_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conference_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20);
            $table->foreignUuid('track_id')->nullable()->constrained('conference_tracks')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['conference_id', 'user_id', 'role', 'track_id'], 'conference_committee_unique');
        });

        Schema::table('conferences', function (Blueprint $table) {
            $table->boolean('book_published')->default(false)->after('feedback_open');
        });
    }

    public function down(): void
    {
        Schema::table('conferences', fn (Blueprint $table) => $table->dropColumn('book_published'));
        Schema::dropIfExists('conference_committee_members');
    }
};
