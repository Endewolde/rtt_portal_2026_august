<?php

namespace App\Http\Middleware;

use App\Enums\Feature;
use App\Models\AppSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'app_settings' => Cache::remember('inertia_app_settings', 300, function () {
                return AppSetting::whereIn('key', [
                    'system_name',
                    'organization_name',
                    'system_logo',
                    'favicon',
                    'primary_color',
                    'secondary_color',
                    'sidebar_color',
                    'announcement_active',
                    'announcement_message',
                    'footer_text',
                    'current_academic_year',
                    'session_timeout_minutes',
                ])->get()->keyBy('key')->map(fn ($s) => $s->value)->toArray();
            }),
            'enabled_features' => Cache::remember('inertia_enabled_features', 300, function () {
                $stored = AppSetting::where('key', 'enabled_features')->value('value');

                if ($stored === null) {
                    return array_column(Feature::cases(), 'value');
                }

                return json_decode($stored, true) ?? [];
            }),
        ];
    }
}
