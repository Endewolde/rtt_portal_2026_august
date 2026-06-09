<?php

namespace App\Services;

use App\Enums\Feature;
use App\Models\College;
use App\Models\Subscription;
use Illuminate\Support\Facades\Cache;

class SubscriptionService
{
    public function hasFeature(College $college, Feature|string $feature): bool
    {
        $slug = $feature instanceof Feature ? $feature->value : $feature;

        return Cache::remember(
            "college:{$college->id}:feature:{$slug}",
            config('features.cache_ttl', 300),
            fn () => $this->resolveFeature($college, $slug),
        );
    }

    /**
     * @return string[] Enabled feature slugs for the college.
     */
    public function getEnabledFeatures(College $college): array
    {
        return Cache::remember(
            "college:{$college->id}:features",
            config('features.cache_ttl', 300),
            function () use ($college) {
                $subscription = $college->activeSubscription()->with('plan')->first();

                if (! $subscription?->isAccessible()) {
                    return [];
                }

                return $subscription->plan->features ?? [];
            },
        );
    }

    /**
     * @return array{ plan: string|null, features: string[], status: string|null, ends_at: string|null }
     */
    public function getSubscriptionSummary(College $college): array
    {
        $subscription = $college->activeSubscription()->with('plan')->first();

        if (! $subscription) {
            return ['plan' => null, 'features' => [], 'status' => null, 'ends_at' => null];
        }

        return [
            'plan'     => $subscription->plan->slug ?? null,
            'features' => $subscription->plan->features ?? [],
            'status'   => $subscription->status->value,
            'ends_at'  => $subscription->ends_at?->toDateString(),
        ];
    }

    /** Flush all feature caches for the given college. */
    public function clearCache(College $college): void
    {
        Cache::forget("college:{$college->id}:features");

        foreach (Feature::cases() as $feature) {
            Cache::forget("college:{$college->id}:feature:{$feature->value}");
        }
    }

    private function resolveFeature(College $college, string $slug): bool
    {
        $subscription = $college->activeSubscription()->with('plan')->first();

        if (! $subscription?->isAccessible()) {
            return false;
        }

        return in_array($slug, $subscription->plan->features ?? []);
    }
}
