<?php

namespace App\Support;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Cache;

/**
 * The organisation's own words and currency (Settings → General), for emails,
 * PDFs, exports and messages. Defaults keep today's wording.
 */
class Terms
{
    public const DEFAULTS = [
        'term_college' => 'College',
        'term_department' => 'Department',
        'term_academic_year' => 'Academic year',
        'currency_code' => 'ETB',
        'currency_name' => 'Ethiopian Birr',
    ];

    public const CACHE_KEY = 'organisation_terms';

    /** @return array<string, string> */
    public static function all(): array
    {
        $saved = Cache::remember(self::CACHE_KEY, 300, fn () => AppSetting::whereIn('key', array_keys(self::DEFAULTS))->pluck('value', 'key')->all());

        return array_merge(self::DEFAULTS, array_filter($saved, fn ($v) => $v !== null && $v !== ''));
    }

    public static function currency(): string
    {
        return strtoupper(self::all()['currency_code']);
    }

    public static function currencyName(): string
    {
        return self::all()['currency_name'];
    }

    public static function college(bool $plural = false): string
    {
        return self::word(self::all()['term_college'], $plural);
    }

    public static function department(bool $plural = false): string
    {
        return self::word(self::all()['term_department'], $plural);
    }

    public static function academicYear(): string
    {
        return self::all()['term_academic_year'];
    }

    /** "ETB 12,500.00" in the organisation's currency. */
    public static function money(float|int|string|null $amount, int $decimals = 2): string
    {
        return self::currency().' '.number_format((float) $amount, $decimals);
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private static function word(string $word, bool $plural): string
    {
        if (! $plural) {
            return $word;
        }

        return preg_match('/[^aeiou]y$/i', $word) ? substr($word, 0, -1).'ies' : (preg_match('/(s|x|ch|sh)$/i', $word) ? $word.'es' : $word.'s');
    }
}
