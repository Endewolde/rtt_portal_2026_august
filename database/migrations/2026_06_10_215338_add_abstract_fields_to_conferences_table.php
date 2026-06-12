<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conferences', function (Blueprint $table) {
            $table->boolean('abstract_submission_open')->default(false)->after('is_featured');
            $table->timestamp('abstract_deadline')->nullable()->after('abstract_submission_open');
        });
    }

    public function down(): void
    {
        Schema::table('conferences', function (Blueprint $table) {
            $table->dropColumn(['abstract_submission_open', 'abstract_deadline']);
        });
    }
};
