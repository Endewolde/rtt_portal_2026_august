<?php

namespace App\Services;

use App\Enums\Feature;
use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class FeatureService
{
    private const CACHE_KEY = 'global:enabled_features';

    private const INERTIA_KEY = 'inertia_enabled_features';

    private const FEATURE_PREFIX = 'global:feature:';

    private const SUB_FEATURE_CACHE_KEY = 'global:disabled_sub_features';

    // Kept in sync with FeatureController::WORKFLOW_DEFAULTS_DISABLED — sub-feature
    // slugs that are off until an admin explicitly enables them in Feature Management.
    private const WORKFLOW_DEFAULTS_DISABLED = [
        'workflow.co_pi_acceptance',
        'workflow.coi_declaration',
        'workflow.budget_revision',
        'workflow.no_cost_extension',
        'workflow.sla_tracking',
        'workflow.ethical_clearance',
        'workflow.proposal_templates',
        'workflow.closure_checklist',
    ];

    public function hasFeature(Feature|string $feature): bool
    {
        $slug = $feature instanceof Feature ? $feature->value : $feature;

        return Cache::remember(
            self::FEATURE_PREFIX.$slug,
            config('features.cache_ttl', 300),
            fn () => in_array($slug, $this->getEnabledFeatures()),
        );
    }

    /**
     * Mirrors resources/js/hooks/useFeature.js's hasSubFeature(): the parent
     * module must be enabled AND the sub-feature must not be explicitly
     * disabled. super_admin bypasses both checks, matching the frontend.
     */
    public function hasSubFeature(string $subSlug, ?User $actor = null): bool
    {
        if ($actor?->hasRole('super_admin')) {
            return true;
        }

        $parent = explode('.', $subSlug)[0];
        if (! $this->hasFeature($parent)) {
            return false;
        }

        return ! in_array($subSlug, $this->getDisabledSubFeatures());
    }

    /** @return string[] Sub-feature slugs explicitly disabled by an admin. */
    public function getDisabledSubFeatures(): array
    {
        return Cache::remember(
            self::SUB_FEATURE_CACHE_KEY,
            config('features.cache_ttl', 300),
            function () {
                $stored = AppSetting::where('key', 'disabled_sub_features')->value('value');

                if ($stored === null) {
                    return self::WORKFLOW_DEFAULTS_DISABLED;
                }

                return json_decode($stored, true) ?? [];
            },
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
                'value' => json_encode(array_values($features)),
                'type' => 'json',
                'group' => 'features',
                'description' => 'Globally enabled platform modules',
            ],
        );

        $this->clearCache();
    }

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Cache::forget(self::INERTIA_KEY);
        Cache::forget(self::SUB_FEATURE_CACHE_KEY);

        foreach (Feature::cases() as $feature) {
            Cache::forget(self::FEATURE_PREFIX.$feature->value);
        }
    }
}
