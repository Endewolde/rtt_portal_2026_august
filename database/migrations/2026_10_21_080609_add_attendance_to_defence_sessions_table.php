<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Whether an open defence actually took place. The college officer records it
     * once the defence date arrives: 'held' lets the result be decided from the
     * panel's scores; 'absent' (the team did not appear) rejects the proposal and
     * voids any scores already submitted. A panel member can flag a no-show for
     * the officer to confirm.
     */
    public function up(): void
    {
        Schema::table('defence_sessions', function (Blueprint $table) {
            $table->string('attendance', 20)->nullable()->after('status');
            $table->text('attendance_note')->nullable()->after('attendance');
            $table->char('attendance_marked_by', 36)->nullable()->after('attendance_note');
            $table->timestamp('attendance_marked_at')->nullable()->after('attendance_marked_by');
            $table->timestamp('attendance_requested_at')->nullable()->after('attendance_marked_at');
            $table->char('absence_reported_by', 36)->nullable()->after('attendance_requested_at');
            $table->timestamp('absence_reported_at')->nullable()->after('absence_reported_by');
            $table->text('absence_report_note')->nullable()->after('absence_reported_at');

            $table->foreign('attendance_marked_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('absence_reported_by')->references('id')->on('users')->nullOnDelete();
        });

        // Creates open_defence.attendance and grants it to college officers.
        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::table('defence_sessions', function (Blueprint $table) {
            $table->dropForeign(['attendance_marked_by']);
            $table->dropForeign(['absence_reported_by']);
            $table->dropColumn([
                'attendance', 'attendance_note', 'attendance_marked_by', 'attendance_marked_at',
                'attendance_requested_at', 'absence_reported_by', 'absence_reported_at', 'absence_report_note',
            ]);
        });
    }
};
