<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feedback_submissions', function (Blueprint $table) {
            $table->unsignedInteger('round')->default(1)->after('user_id');
        });

        Schema::table('feedback_submissions', function (Blueprint $table) {
            $table->unique(['user_id', 'round']);
        });

        Schema::table('feedback_submissions', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });

        $exists = DB::table('app_settings')->where('key', 'feedback_current_round')->exists();
        if (! $exists) {
            DB::table('app_settings')->insert([
                'id' => Str::uuid()->toString(),
                'key' => 'feedback_current_round',
                'value' => '1',
                'type' => 'number',
                'group' => 'general',
                'description' => 'Current feedback round — incremented when an admin starts a new round, re-opening the popup for everyone',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('feedback_submissions', function (Blueprint $table) {
            $table->unique('user_id');
        });

        Schema::table('feedback_submissions', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'round']);
            $table->dropColumn('round');
        });

        DB::table('app_settings')->where('key', 'feedback_current_round')->delete();
    }
};
