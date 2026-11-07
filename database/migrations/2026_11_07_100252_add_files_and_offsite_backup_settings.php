<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const ROWS = [
        ['key' => 'backup_include_files', 'value' => 'true', 'type' => 'boolean', 'group' => 'backup', 'description' => 'Archive the uploaded files (documents, letters, images) once a day with the database'],
        ['key' => 'backup_offsite_path', 'value' => '', 'type' => 'string', 'group' => 'backup', 'description' => 'Copy every backup here — another server as user@host:/path (SSH key login) or a mounted drive path'],
    ];

    public function up(): void
    {
        foreach (self::ROWS as $row) {
            if (! DB::table('app_settings')->where('key', $row['key'])->exists()) {
                DB::table('app_settings')->insert($row + ['id' => Str::uuid()->toString(), 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void
    {
        DB::table('app_settings')->whereIn('key', array_column(self::ROWS, 'key'))->delete();
    }
};
