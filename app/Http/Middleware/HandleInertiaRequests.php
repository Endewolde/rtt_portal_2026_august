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
                    'system_tagline',
                    'organization_name',
                    'system_logo',
                    'favicon',
                    'login_institution_text',
                    'logo_width',
                    'logo_height',
                    'auth_panel_from_color',
                    'auth_panel_to_color',
                    'primary_color',
                    'secondary_color',
                    'sidebar_color',
                    'announcement_active',
                    'announcement_message',
                    'footer_text',
                    'current_academic_year',
                    'session_timeout_minutes',
                    'sso_enabled',
                    'google_sso_enabled',
                    'microsoft_sso_enabled',
                    // Public site content
                    'public_header_tagline',
                    'public_footer_tagline',
                    'public_hero_badge',
                    'public_hero_heading',
                    'public_hero_highlight',
                    'public_hero_subtitle',
                    'public_hero_cta_primary',
                    'public_hero_cta_secondary',
                    'public_show_stats',
                    'public_show_open_calls',
                    'public_show_how_it_works',
                    'public_show_features',
                    'public_show_cta',
                    'public_step_1_title',
                    'public_step_1_desc',
                    'public_step_2_title',
                    'public_step_2_desc',
                    'public_step_3_title',
                    'public_step_3_desc',
                    'public_step_4_title',
                    'public_step_4_desc',
                    'public_features_title',
                    'public_features_subtitle',
                    'public_cta_title',
                    'public_cta_subtitle',
                    'public_cta_primary',
                    'public_cta_secondary',
                    'public_topbar_bg',
                    'public_hero_bg',
                    'public_cards_bg',
                    'public_features_bg',
                    'public_footer_bg',
                    // Nav items
                    'public_nav_item_1_label', 'public_nav_item_1_href', 'public_nav_item_1_show',
                    'public_nav_item_2_label', 'public_nav_item_2_href', 'public_nav_item_2_show',
                    'public_nav_item_3_label', 'public_nav_item_3_href', 'public_nav_item_3_show',
                    'public_nav_item_4_label', 'public_nav_item_4_href', 'public_nav_item_4_show',
                    'public_nav_item_5_label', 'public_nav_item_5_href', 'public_nav_item_5_show',
                    // Social links
                    'public_social_telegram',
                    'public_social_facebook',
                    'public_social_twitter',
                    'public_social_linkedin',
                    'public_social_instagram',
                    'public_social_youtube',
                    'self_registration',
                    'public_topbar_text',
                    'developer_credits',
                    'feedback_popup_enabled',
                ])->get()->keyBy('key')->map(fn ($s) => $s->value)->toArray();
            }),
            'enabled_features' => Cache::remember('inertia_enabled_features', 300, function () {
                $stored = AppSetting::where('key', 'enabled_features')->value('value');

                if ($stored === null) {
                    return array_column(Feature::cases(), 'value');
                }

                return json_decode($stored, true) ?? [];
            }),
            'disabled_sub_features' => Cache::remember('inertia_disabled_sub_features', 300, function () {
                $stored = AppSetting::where('key', 'disabled_sub_features')->value('value');

                return $stored ? (json_decode($stored, true) ?? []) : [];
            }),
        ];
    }
}
