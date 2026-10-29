<?php

namespace App\Providers;

use App\Enums\Feature;
use App\Models\Award;
use App\Models\Proposal;
use App\Models\ResearchOutput;
use App\Models\User;
use App\Services\FeatureService;
use App\Services\IntegrationService;
use App\Support\Programmes;
use App\Support\Terms;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\ServiceProvider;
use SocialiteProviders\Azure\AzureExtendSocialite;
use SocialiteProviders\Manager\SocialiteWasCalled;
use Spatie\Permission\Models\Role;

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

        // dompdf writes font metrics into its font cache the first time a PDF uses a font
        // (the Ethiopic one in pdf.partials.fonts). storage/ isn't deployed, so on a fresh
        // server that folder doesn't exist and every PDF fails until it's created.
        $this->app->resolving('dompdf', fn () => File::ensureDirectoryExists(config('dompdf.options.font_cache', storage_path('fonts'))));

        $this->registerFeatureGates();
        $this->registerWebhookEvents();

        // Who directs each programme follows role scopes, so a role change refreshes it.
        Role::saved(fn () => Programmes::forget());
        Role::deleted(fn () => Programmes::forget());
    }

    /** Other systems connected by webhook hear about stage changes, awards and new research outputs. */
    private function registerWebhookEvents(): void
    {
        Proposal::updated(function (Proposal $proposal) {
            if (! $proposal->wasChanged('status')) {
                return;
            }
            app(IntegrationService::class)->dispatch('proposal.status_changed', [
                'id' => $proposal->id,
                'tracker_number' => $proposal->tracker_number,
                'title' => $proposal->title,
                'category' => $proposal->category,
                'academic_year' => $proposal->academic_year,
                'college_id' => $proposal->college_id,
                'previous_status' => $proposal->getOriginal('status'),
                'status' => $proposal->status,
                'changed_at' => now()->toIso8601String(),
            ]);
        });

        Award::created(function (Award $award) {
            $proposal = $award->proposal()->first(['id', 'tracker_number', 'title', 'category', 'academic_year', 'college_id']);
            app(IntegrationService::class)->dispatch('award.created', [
                'id' => $award->id,
                'grant_reference' => $award->grant_reference,
                'awarded_amount' => (float) $award->awarded_amount,
                'currency' => Terms::currency(),
                'approved_at' => $award->approved_at?->toIso8601String(),
                'proposal' => $proposal?->only(['id', 'tracker_number', 'title', 'category', 'academic_year', 'college_id']),
            ]);
        });

        ResearchOutput::created(function (ResearchOutput $output) {
            app(IntegrationService::class)->dispatch('research_output.created', [
                'id' => $output->id,
                'type' => $output->output_type,
                'title' => $output->title,
                'proposal_id' => $output->proposal_id,
                'created_at' => $output->created_at?->toIso8601String(),
            ]);
        });
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
