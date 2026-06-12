<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('thematic_areas', function (Blueprint $table) {
            $table->json('sub_topics')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('thematic_areas', function (Blueprint $table) {
            $table->dropColumn('sub_topics');
        });
    }
};
