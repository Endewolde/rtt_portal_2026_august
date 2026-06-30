<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_requests', function (Blueprint $table) {
            $table->text('finance_notes')->nullable()->after('college_review_notes');
            $table->timestamp('college_approved_at')->nullable()->after('approved_at');
            $table->timestamp('finance_returned_at')->nullable()->after('college_approved_at');
        });
    }

    public function down(): void
    {
        Schema::table('budget_requests', function (Blueprint $table) {
            $table->dropColumn(['finance_notes', 'college_approved_at', 'finance_returned_at']);
        });
    }
};
