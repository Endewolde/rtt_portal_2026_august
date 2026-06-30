<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->dropCheckIfExists('chk_br_status');
        DB::statement("ALTER TABLE budget_requests ADD CONSTRAINT chk_br_status CHECK (status IN ('draft','pending_signatures','submitted','under_college_review','finance_returned','college_approved','approved','rejected','disbursed','settled'))");
    }

    public function down(): void
    {
        $this->dropCheckIfExists('chk_br_status');
        DB::statement("ALTER TABLE budget_requests ADD CONSTRAINT chk_br_status CHECK (status IN ('draft','pending_signatures','submitted','under_college_review','approved','rejected','disbursed','settled'))");
    }

    private function dropCheckIfExists(string $name): void
    {
        $exists = DB::selectOne(
            "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'budget_requests'
               AND CONSTRAINT_NAME = ?",
            [$name]
        );

        if ($exists) {
            DB::statement("ALTER TABLE budget_requests DROP CHECK {$name}");
        }
    }
};
