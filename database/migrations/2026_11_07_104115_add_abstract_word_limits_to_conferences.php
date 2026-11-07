<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conferences', function (Blueprint $table) {
            // The limits the submission form already showed (50–800 words), now enforced and per conference.
            $table->unsignedSmallInteger('abstract_min_words')->default(50)->after('camera_ready_deadline');
            $table->unsignedSmallInteger('abstract_max_words')->default(800)->after('abstract_min_words');
        });
    }

    public function down(): void
    {
        Schema::table('conferences', fn (Blueprint $table) => $table->dropColumn(['abstract_min_words', 'abstract_max_words']));
    }
};
