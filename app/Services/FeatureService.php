<?php

namespace App\Services;

use App\Enums\Feature;
use App\Models\AppSetting;
use Illuminate\Support\Facades\Cache;

class FeatureService
{
    private const CACHE_KEY     = 'global:enabled_features';
    private const INERTIA_KEY   = 'inertia_enabled_features';
    private const FEATURE_PREFIX = 'global:feature:';

    public function hasFeature(Feature|string $feature): bool
    {
        $slug = $feature instanceof Feature ? $feature->value : $feature;

        return Cache::remember(
            self::FEATURE_PREFIX . $slug,
            config('features.cache_ttl', 300),
            fn () => in_array($slug, $this->getEnabledFeatures()),
        );
    }

    /** @return string[] Currently enabled feature slugs. */
    public function getEnabledFeatures(): array
    {
        return Cache::remember(
            self::CACHE_KEY,
            config('features.cache_ttl', 300),
            function () {
                $stored = AppSetting::where('key', 'enabled_features')->value('value');

                // All features on by default when no setting exists yet.
                if ($stored === null) {
                    return array_column(Feature::cases(), 'value');
                }

                return json_decode($stored, true) ?? [];
            },
        );
    }

    /** Persist the new set and flush all related caches. */
    public function setEnabledFeatures(array $features): void
    {
        AppSetting::updateOrCreate(
            ['key' => 'enabled_features'],
            [
                'value'       => json_encode(array_values($features)),
                'type'        => 'json',
                'group'       => 'features',
                'description' => 'Globally enabled platform modules',
            ],
        );

        $this->clearCache();
    }

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::INERTIA_KEY);

        foreach (Feature::cases() as $feature) {
            Cache::forget(self::FEATURE_PREFIX . $feature->value);
        }
    }
}
