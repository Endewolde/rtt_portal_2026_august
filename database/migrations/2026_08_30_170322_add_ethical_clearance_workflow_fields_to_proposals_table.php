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
            $table->enum('ethical_clearance_status', ['pending', 'submitted', 'approved', 'rejected', 'expired'])
                ->nullable()->after('ethical_clearance_number');
            $table->date('ethical_clearance_expiry')->nullable()->after('ethical_clearance_status');
            $table->timestamp('ethical_clearance_submitted_at')->nullable()->after('ethical_clearance_expiry');
            $table->uuid('ethical_clearance_verified_by')->nullable()->after('ethical_clearance_submitted_at');
            $table->timestamp('ethical_clearance_verified_at')->nullable()->after('ethical_clearance_verified_by');
            $table->text('ethical_clearance_rejection_reason')->nullable()->after('ethical_clearance_verified_at');

            $table->foreign('ethical_clearance_verified_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropForeign(['ethical_clearance_verified_by']);
            $table->dropColumn([
                'ethical_clearance_status',
                'ethical_clearance_expiry',
                'ethical_clearance_submitted_at',
                'ethical_clearance_verified_by',
                'ethical_clearance_verified_at',
                'ethical_clearance_rejection_reason',
            ]);
        });
    }
};
