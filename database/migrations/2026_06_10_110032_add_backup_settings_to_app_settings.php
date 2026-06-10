<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $rows = [
            ['key' => 'auto_backup_enabled',    'value' => 'false', 'type' => 'boolean', 'group' => 'backup', 'description' => 'Enable automatic daily backups'],
            ['key' => 'backup_schedule',         'value' => 'daily', 'type' => 'string',  'group' => 'backup', 'description' => 'Backup schedule frequency'],
            ['key' => 'backup_retention_days',   'value' => '30',    'type' => 'number',  'group' => 'backup', 'description' => 'Days to retain backup files'],
            ['key' => 'backup_notify_email',     'value' => 'true',  'type' => 'boolean', 'group' => 'backup', 'description' => 'Send backup file via email'],
            ['key' => 'backup_notify_telegram',  'value' => 'false', 'type' => 'boolean', 'group' => 'backup', 'description' => 'Send backup file via Telegram'],
            ['key' => 'backup_email_recipient',  'value' => '',      'type' => 'string',  'group' => 'backup', 'description' => 'Email address to receive backup files'],
            ['key' => 'backup_telegram_chat_id', 'value' => '',       'type' => 'string',  'group' => 'backup', 'description' => 'Telegram chat ID to receive backup files'],
            ['key' => 'backup_time',             'value' => '02:00',  'type' => 'time',    'group' => 'backup', 'description' => 'Time of day to run the automated backup (HH:MM)'],
        ];

        foreach ($rows as $row) {
            $exists = DB::table('app_settings')->where('key', $row['key'])->exists();
            if (! $exists) {
                DB::table('app_settings')->insert(array_merge($row, [
                    'id' => Str::uuid()->toString(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            } else {
                DB::table('app_settings')->where('key', $row['key'])->update([
                    'type' => $row['type'],
                    'group' => $row['group'],
                    'description' => $row['description'],
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('app_settings')->whereIn('key', [
            'auto_backup_enabled',
            'backup_schedule',
            'backup_retention_days',
            'backup_notify_email',
            'backup_notify_telegram',
            'backup_email_recipient',
            'backup_telegram_chat_id',
            'backup_time',
        ])->delete();
    }
};
