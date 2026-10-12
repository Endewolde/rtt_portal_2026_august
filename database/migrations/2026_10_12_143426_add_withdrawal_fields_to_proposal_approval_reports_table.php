<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('proposal_approval_reports', function (Blueprint $table) {
            // The stage the report pulled the proposal back from, so withdrawing the
            // report can put it back exactly where it was.
            $table->string('returned_from_status', 50)->nullable()->after('status');
            $table->dateTime('withdrawn_at')->nullable()->after('reviewed_at');
        });

        // A report can now also be withdrawn by the officer who filed it.
        DB::statement('ALTER TABLE proposal_approval_reports DROP CHECK chk_par_status');
        DB::statement("ALTER TABLE proposal_approval_reports ADD CONSTRAINT chk_par_status CHECK (status IN ('open','reviewed','withdrawn'))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE proposal_approval_reports DROP CHECK chk_par_status');
        DB::statement("ALTER TABLE proposal_approval_reports ADD CONSTRAINT chk_par_status CHECK (status IN ('open','reviewed'))");

        Schema::table('proposal_approval_reports', function (Blueprint $table) {
            $table->dropColumn(['returned_from_status', 'withdrawn_at']);
        });
    }
};
