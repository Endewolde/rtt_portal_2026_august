<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** The UN Sustainable Development Goals a proposal contributes to (numbers 1–17, up to three). */
    public function up(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->json('sdgs')->nullable()->after('keywords');
        });
    }

    public function down(): void
    {
        Schema::table('proposals', function (Blueprint $table) {
            $table->dropColumn('sdgs');
        });
    }
};
