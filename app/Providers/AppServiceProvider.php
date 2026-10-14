<?php

namespace App\Providers;

use App\Enums\Feature;
use App\Models\User;
use App\Services\FeatureService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\ServiceProvider;
use SocialiteProviders\Azure\AzureExtendSocialite;
use SocialiteProviders\Manager\SocialiteWasCalled;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // Server has no IPv6 — force IPv4 to avoid multi-second retry delays on OAuth calls
        Http::globalOptions(['curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4]]);

        // Listeners in app/Listeners are auto-discovered from their handle() type-hints —
        // registering them here as well made every one run twice (duplicate workflow
        // emails and bell notifications). Only listeners outside app/Listeners go here.
        Event::listen(SocialiteWasCalled::class, [AzureExtendSocialite::class, 'handle']);

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
