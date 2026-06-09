<?php

namespace App\Providers;

use App\Enums\Feature;
use App\Events\ProposalTransitioned;
use App\Listeners\GenerateAwardOnFunding;
use App\Models\User;
use App\Services\FeatureService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Event::listen(ProposalTransitioned::class, GenerateAwardOnFunding::class);

        $this->registerFeatureGates();
    }

    private function registerFeatureGates(): void
    {
        $bypassRoles = config('features.bypass_roles', ['super_admin']);

        foreach (Feature::cases() as $feature) {
            Gate::define("feature:{$feature->value}", function (User $user) use ($feature, $bypassRoles) {
                if ($user->hasAnyRole($bypassRoles)) {
                    return true;
                }

                return app(FeatureService::class)->hasFeature($feature);
            });
        }
    }
}
