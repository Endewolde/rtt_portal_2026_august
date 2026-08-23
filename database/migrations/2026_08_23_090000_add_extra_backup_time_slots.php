<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // backup_time already exists as the first of three daily backup runs
        // (see 2026_06_10_110032_add_backup_settings_to_app_settings.php) —
        // these are the second and third slots for the 3x/day schedule.
        $rows = [
            ['key' => 'backup_time_2', 'value' => '18:00', 'type' => 'time', 'group' => 'backup', 'description' => 'Second daily automated backup time (HH:MM)'],
            ['key' => 'backup_time_3', 'value' => '00:00', 'type' => 'time', 'group' => 'backup', 'description' => 'Third daily automated backup time (HH:MM)'],
        ];

        foreach ($rows as $row) {
            $exists = DB::table('app_settings')->where('key', $row['key'])->exists();
            if (! $exists) {
                DB::table('app_settings')->insert(array_merge($row, [
                    'id' => Str::uuid()->toString(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }
        }
    }

    public function down(): void
    {
        DB::table('app_settings')->whereIn('key', ['backup_time_2', 'backup_time_3'])->delete();
    }
};
