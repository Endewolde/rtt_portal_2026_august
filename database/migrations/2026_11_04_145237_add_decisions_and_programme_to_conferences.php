<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conferences', function (Blueprint $table) {
            $table->timestamp('camera_ready_deadline')->nullable()->after('abstract_deadline');
        });

        Schema::table('conference_sessions', function (Blueprint $table) {
            $table->string('chair')->nullable()->after('room');
        });

        Schema::table('conference_abstracts', function (Blueprint $table) {
            $table->string('accepted_type', 20)->nullable()->after('presentation_type');
            $table->string('camera_ready_path')->nullable()->after('file_path');
            $table->timestamp('camera_ready_at')->nullable()->after('camera_ready_path');
            $table->timestamp('decided_at')->nullable()->after('submitted_at');
            $table->foreignUuid('session_id')->nullable()->after('track_id')->constrained('conference_sessions')->nullOnDelete();
            $table->unsignedSmallInteger('session_order')->nullable()->after('session_id');
        });
    }

    public function down(): void
    {
        Schema::table('conference_abstracts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('session_id');
            $table->dropColumn(['accepted_type', 'camera_ready_path', 'camera_ready_at', 'decided_at', 'session_order']);
        });
        Schema::table('conference_sessions', fn (Blueprint $table) => $table->dropColumn('chair'));
        Schema::table('conferences', fn (Blueprint $table) => $table->dropColumn('camera_ready_deadline'));
    }
};
