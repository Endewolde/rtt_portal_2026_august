<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('app_settings')->where('key', 'max_concurrent_sessions')->exists();
        if (! $exists) {
            DB::table('app_settings')->insert([
                'id' => Str::uuid()->toString(),
                'key' => 'max_concurrent_sessions',
                'value' => '1',
                'type' => 'number',
                'group' => 'security',
                'description' => 'security',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('app_settings')->where('key', 'max_concurrent_sessions')->delete();
    }
};
