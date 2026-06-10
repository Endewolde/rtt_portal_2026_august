<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('app_settings')
            ->where('key', 'telegram_bot_token')
            ->update(['group' => 'integration', 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('app_settings')
            ->where('key', 'telegram_bot_token')
            ->update(['group' => 'email', 'updated_at' => now()]);
    }
};
