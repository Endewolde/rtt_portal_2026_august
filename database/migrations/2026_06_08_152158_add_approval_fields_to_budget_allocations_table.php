<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_allocations', function (Blueprint $table) {
            $table->string('status', 20)->default('pending')->after('allocation_type');
            $table->char('approved_by', 36)->nullable()->after('status');
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->text('rejection_reason')->nullable()->after('approved_at');

            $table->foreign('approved_by')->references('id')->on('users');
        });

        DB::statement("ALTER TABLE budget_allocations ADD CONSTRAINT chk_alloc_status CHECK (status IN ('pending','approved','rejected'))");
    }

    public function down(): void
    {
        Schema::table('budget_allocations', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropColumn(['status', 'approved_by', 'approved_at', 'rejection_reason']);
        });
    }
};
