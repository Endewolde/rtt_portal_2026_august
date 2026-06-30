<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->boolean('ethical_clearance_required')->default(false)->after('research_type');
            $table->string('ethical_clearance_number', 100)->nullable()->after('ethical_clearance_required');
            $table->timestamp('status_entered_at')->nullable()->after('rejected_at');
        });
    }

    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropColumn(['ethical_clearance_required', 'ethical_clearance_number', 'status_entered_at']);
        });
    }
};
