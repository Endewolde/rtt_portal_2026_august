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
        Schema::table('proposal_approval_reports', function (Blueprint $table) {
            // What the college officer says is wrong (see ProposalApprovalReport::ISSUE_TYPES).
            $table->string('issue_type', 50)->nullable()->after('reported_by');
            // Details are only required for "other"; listed issues may come without them.
            $table->text('reason')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('proposal_approval_reports', function (Blueprint $table) {
            $table->dropColumn('issue_type');
            $table->text('reason')->nullable(false)->change();
        });
    }
};
