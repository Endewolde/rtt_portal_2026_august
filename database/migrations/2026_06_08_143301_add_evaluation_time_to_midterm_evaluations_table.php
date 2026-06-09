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
        Schema::table('midterm_evaluations', function (Blueprint $table) {
            $table->time('evaluation_time')->nullable()->after('evaluation_date');
            $table->string('venue', 300)->nullable()->after('evaluation_time');
        });
    }

    public function down(): void
    {
        Schema::table('midterm_evaluations', function (Blueprint $table) {
            $table->dropColumn(['evaluation_time', 'venue']);
        });
    }
};
