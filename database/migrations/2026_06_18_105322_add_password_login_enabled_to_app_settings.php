<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('app_settings')->insertOrIgnore([
            'key' => 'password_login_enabled',
            'value' => 'true',
            'type' => 'boolean',
            'group' => 'integration',
        ]);
    }

    public function down(): void
    {
        DB::table('app_settings')->where('key', 'password_login_enabled')->delete();
    }
};
