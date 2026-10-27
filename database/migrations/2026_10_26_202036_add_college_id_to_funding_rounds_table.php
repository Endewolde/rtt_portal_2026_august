<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A funding round can cover one college: College RTT Managers decide their own
     * college's proposals of a call (every category). Null is the whole call.
     */
    public function up(): void
    {
        Schema::table('funding_rounds', function (Blueprint $table) {
            $table->foreignUuid('college_id')->nullable()->after('proposal_call_id')->constrained('colleges')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('funding_rounds', function (Blueprint $table) {
            $table->dropConstrainedForeignId('college_id');
        });
    }
};
