<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->enum('contract_status', ['pending', 'approved', 'rejected'])
                ->nullable()
                ->after('contract_document_path');
            $table->timestamp('contract_submitted_at')->nullable()->after('contract_status');
            $table->char('contract_submitted_by', 36)->nullable()->after('contract_submitted_at');
            $table->text('contract_rejection_reason')->nullable()->after('contract_submitted_by');
        });
    }

    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropColumn([
                'contract_status',
                'contract_submitted_at',
                'contract_submitted_by',
                'contract_rejection_reason',
            ]);
        });
    }
};
