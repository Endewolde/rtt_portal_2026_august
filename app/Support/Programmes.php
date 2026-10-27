<?php

namespace App\Support;

use App\Models\Programme;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The organisation's funding programmes, cached: labels, tracker prefixes and the
 * roles that direct each one (any role whose data scope is that programme). Falls
 * back to the three built-in programmes before the table exists.
 */
class Programmes
{
    public const CACHE_KEY = 'programmes_v1';

    private const FALLBACK = [
        ['key' => 'research', 'name' => 'Research', 'tracker_prefix' => 'RES', 'color' => '#3b82f6', 'is_active' => true],
        ['key' => 'community_engagement', 'name' => 'Community Engagement', 'tracker_prefix' => 'COM', 'color' => '#10b981', 'is_active' => true],
        ['key' => 'technology_transfer', 'name' => 'Technology Transfer', 'tracker_prefix' => 'TECH', 'color' => '#8b5cf6', 'is_active' => true],
    ];

    /** @return Collection<int, array{key: string, name: string, tracker_prefix: string, color: string, is_active: bool, description?: ?string}> */
    public static function all(): Collection
    {
        return collect(Cache::rememberForever(self::CACHE_KEY, function () {
            if (! Schema::hasTable('programmes')) {
                return self::FALLBACK;
            }

            return Programme::orderBy('sort_order')->orderBy('name')
                ->get(['key', 'name', 'tracker_prefix', 'description', 'color', 'is_active'])
                ->map(fn ($p) => $p->only(['key', 'name', 'tracker_prefix', 'description', 'color', 'is_active']))
                ->all();
        }));
    }

    /** @return Collection<int, array<string, mixed>> */
    public static function active(): Collection
    {
        return self::all()->where('is_active', true)->values();
    }

    /** @return list<string> */
    public static function keys(bool $activeOnly = false): array
    {
        return ($activeOnly ? self::active() : self::all())->pluck('key')->all();
    }

    /** @return array<string, string> key => name */
    public static function labels(): array
    {
        return self::all()->pluck('name', 'key')->all();
    }

    public static function label(?string $key): string
    {
        return self::labels()[$key] ?? ucwords(str_replace('_', ' ', (string) $key));
    }

    public static function prefix(string $key): ?string
    {
        return self::all()->firstWhere('key', $key)['tracker_prefix'] ?? null;
    }

    /**
     * Roles that direct a programme: any role (built-in or custom) whose data scope
     * is that one programme.
     *
     * @return list<string>
     */
    public static function directorRoles(?string $key): array
    {
        if (! $key) {
            return [];
        }

        return Cache::remember(self::CACHE_KEY.':directors:'.$key, 300, fn () => DB::table('roles')
            ->where('scope', 'category')->where('scope_category', $key)->pluck('name')->all());
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
        foreach (self::keys() as $key) {
            Cache::forget(self::CACHE_KEY.':directors:'.$key);
        }
    }
}
