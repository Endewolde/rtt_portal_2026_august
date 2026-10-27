<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A call can ask its own questions and documents on top of the standard
     * application; applicants' answers are kept on the proposal.
     */
    public function up(): void
    {
        Schema::table('proposal_calls', function (Blueprint $table) {
            $table->json('application_form')->nullable()->after('funding_budget');
        });

        Schema::table('proposals', function (Blueprint $table) {
            $table->json('call_answers')->nullable()->after('sdgs');
        });
    }

    public function down(): void
    {
        Schema::table('proposal_calls', function (Blueprint $table) {
            $table->dropColumn('application_form');
        });

        Schema::table('proposals', function (Blueprint $table) {
            $table->dropColumn('call_answers');
        });
    }
};
