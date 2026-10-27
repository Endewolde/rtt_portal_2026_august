<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /** The organisation's own words and currency, editable in Settings → General. */
    private const SETTINGS = [
        'term_college' => ['College', 'What your top-level units are called (e.g. Faculty, School, Directorate).'],
        'term_department' => ['Department', 'What units inside them are called (e.g. Unit, Division, Programme).'],
        'term_academic_year' => ['Academic year', 'What your reporting year is called (e.g. Fiscal year, Budget year).'],
        'currency_code' => ['ETB', 'Three-letter currency code shown on amounts (e.g. ETB, USD, KES).'],
        'currency_name' => ['Ethiopian Birr', 'Currency name used in award letters, e.g. "fifty thousand Ethiopian Birr".'],
    ];

    public function up(): void
    {
        foreach (self::SETTINGS as $key => [$value, $description]) {
            if (DB::table('app_settings')->where('key', $key)->exists()) {
                continue;
            }
            DB::table('app_settings')->insert([
                'id' => (string) Str::uuid(), 'key' => $key, 'value' => $value, 'type' => 'string',
                'group' => 'general', 'description' => $description, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('app_settings')->whereIn('key', array_keys(self::SETTINGS))->delete();
    }
};
