<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ensure table collation matches users.id (utf8mb4_unicode_ci) before adding FKs.
        // Production tables created with MySQL 8 default (utf8mb4_0900_ai_ci) will fail FK checks otherwise.
        DB::statement('ALTER TABLE research_outputs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

        Schema::table('research_outputs', function (Blueprint $table) {
            if (! Schema::hasColumn('research_outputs', 'status')) {
                $table->string('status', 20)->default('pending')->after('recorded_by');
            }
            if (! Schema::hasColumn('research_outputs', 'review_notes')) {
                $table->text('review_notes')->nullable()->after('status');
            }
            if (! Schema::hasColumn('research_outputs', 'verified_by')) {
                $table->char('verified_by', 36)->nullable()->after('review_notes');
            }
            if (! Schema::hasColumn('research_outputs', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('verified_by');
            }
            if (! Schema::hasColumn('research_outputs', 'approved_by')) {
                $table->char('approved_by', 36)->nullable()->after('verified_at');
            }
            if (! Schema::hasColumn('research_outputs', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            }
        });

        // Add FKs only if they don't already exist (handles partial migration state)
        $this->addForeignIfMissing('research_outputs', 'research_outputs_verified_by_foreign', function (Blueprint $table) {
            $table->foreign('verified_by')->references('id')->on('users')->nullOnDelete();
        });

        $this->addForeignIfMissing('research_outputs', 'research_outputs_approved_by_foreign', function (Blueprint $table) {
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('research_outputs', function (Blueprint $table) {
            $table->dropForeign(['verified_by']);
            $table->dropForeign(['approved_by']);
            $table->dropColumn(['status', 'review_notes', 'verified_by', 'verified_at', 'approved_by', 'approved_at']);
        });
    }

    private function addForeignIfMissing(string $tableName, string $constraintName, callable $callback): void
    {
        $exists = DB::selectOne(
            'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND CONSTRAINT_NAME = ?',
            [$tableName, $constraintName]
        );

        if (! $exists) {
            Schema::table($tableName, $callback);
        }
    }
};
