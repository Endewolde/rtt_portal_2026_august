<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->timestamp('contract_signed_at')->nullable()->after('status_entered_at');
            $table->char('contract_signed_by', 36)->nullable()->after('contract_signed_at');
            $table->string('contract_document_path', 500)->nullable()->after('contract_signed_by');
        });
    }

    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropColumn(['contract_signed_at', 'contract_signed_by', 'contract_document_path']);
        });
    }
};
