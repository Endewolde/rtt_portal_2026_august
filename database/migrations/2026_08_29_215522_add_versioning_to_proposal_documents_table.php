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
        Schema::table('proposal_documents', function (Blueprint $table) {
            $table->unsignedInteger('version')->default(1)->after('document_type');
            $table->boolean('is_current')->default(true)->after('version');
            $table->index(['proposal_id', 'document_type', 'is_current']);
        });

        // Backfill: existing rows of the same (proposal_id, document_type) were
        // previously indistinguishable siblings. Order them by upload time and
        // number them 1..N, marking only the most recent as current so the new
        // "current version" concept reflects what was actually most recently shared.
        DB::table('proposal_documents')
            ->select('proposal_id', 'document_type')
            ->groupBy('proposal_id', 'document_type')
            ->havingRaw('COUNT(*) > 1')
            ->get()
            ->each(function ($group) {
                $rows = DB::table('proposal_documents')
                    ->where('proposal_id', $group->proposal_id)
                    ->where('document_type', $group->document_type)
                    ->orderBy('created_at')
                    ->get(['id']);

                foreach ($rows as $index => $row) {
                    DB::table('proposal_documents')->where('id', $row->id)->update([
                        'version' => $index + 1,
                        'is_current' => $index === $rows->count() - 1,
                    ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('proposal_documents', function (Blueprint $table) {
            $table->dropIndex(['proposal_id', 'document_type', 'is_current']);
            $table->dropColumn(['version', 'is_current']);
        });
    }
};
