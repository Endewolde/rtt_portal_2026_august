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
        Schema::table('proposals', function (Blueprint $table) {
            // Mirrors the audit trail form_signatures already captures for budget
            // requests (who, when, from where) — contracts only had signed_at/by
            // on approval and a bare reason on rejection, no IP on any step and no
            // who/when at all on rejection.
            $table->string('contract_submitted_ip', 45)->nullable()->after('contract_submitted_by');
            $table->string('contract_signed_ip', 45)->nullable()->after('contract_signed_by');
            $table->timestamp('contract_rejected_at')->nullable()->after('contract_rejection_reason');
            $table->char('contract_rejected_by', 36)->nullable()->after('contract_rejected_at');
            $table->string('contract_rejected_ip', 45)->nullable()->after('contract_rejected_by');

            $table->foreign('contract_rejected_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropForeign(['contract_rejected_by']);
            $table->dropColumn([
                'contract_submitted_ip',
                'contract_signed_ip',
                'contract_rejected_at',
                'contract_rejected_by',
                'contract_rejected_ip',
            ]);
        });
    }
};
