<?php

use App\Support\Access\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** How useful a submitted review was (1 thin, 2 adequate, 3 useful), rated by the office. */
    public function up(): void
    {
        Schema::table('review_assignments', function (Blueprint $table) {
            $table->unsignedTinyInteger('quality_rating')->nullable()->after('status');
            $table->foreignUuid('quality_rated_by')->nullable()->after('quality_rating')->constrained('users')->nullOnDelete();
            $table->timestamp('quality_rated_at')->nullable()->after('quality_rated_by');
        });

        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::table('review_assignments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('quality_rated_by');
            $table->dropColumn(['quality_rating', 'quality_rated_at']);
        });
    }
};
