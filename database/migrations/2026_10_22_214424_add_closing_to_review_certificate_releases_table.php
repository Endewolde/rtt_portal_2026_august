<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A released year can be closed: its certificates stop downloading and verify as
     * withdrawn until the year is reopened or released again.
     */
    public function up(): void
    {
        Schema::table('review_certificate_releases', function (Blueprint $table) {
            $table->timestamp('closed_at')->nullable()->after('released_at');
            $table->foreignUuid('closed_by')->nullable()->after('closed_at')->constrained('users')->nullOnDelete();
            $table->text('close_reason')->nullable()->after('closed_by');
        });
    }

    public function down(): void
    {
        Schema::table('review_certificate_releases', function (Blueprint $table) {
            $table->dropConstrainedForeignId('closed_by');
            $table->dropColumn(['closed_at', 'close_reason']);
        });
    }
};
