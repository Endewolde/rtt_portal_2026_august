<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mentorship: experienced researchers say they are open to mentoring; others
     * ask one of them, optionally about a specific proposal; the mentor accepts or
     * declines, and either side can end it.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('mentor_available')->default(false)->after('public_profile');
            $table->string('mentor_note', 500)->nullable()->after('mentor_available');
        });

        Schema::create('mentorships', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('mentee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('mentor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('proposal_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 12)->default('requested');
            $table->text('message')->nullable();
            $table->text('response')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['mentor_id', 'status']);
            $table->index(['mentee_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mentorships');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['mentor_available', 'mentor_note']);
        });
    }
};
