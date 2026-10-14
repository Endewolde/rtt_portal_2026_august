<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Reviewer certificates are signed by the Vice President, not the Director. Only the
 * untouched old default is replaced — a title an admin already customised stays.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('app_settings')
            ->where('key', 'certificate_signatory_title')
            ->where('value', 'Director, Research & Technology Transfer')
            ->update(['value' => 'Vice President, Research & Technology Transfer', 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('app_settings')
            ->where('key', 'certificate_signatory_title')
            ->where('value', 'Vice President, Research & Technology Transfer')
            ->update(['value' => 'Director, Research & Technology Transfer', 'updated_at' => now()]);
    }
};
