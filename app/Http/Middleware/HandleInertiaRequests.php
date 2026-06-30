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
                    'password_login_enabled',
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
                    // Hero slider content (slides 1–6)
                    'slider_slide_count',
                    'slider_slide_1_eyebrow', 'slider_slide_1_heading', 'slider_slide_1_highlight',
                    'slider_slide_1_subtitle', 'slider_slide_1_cta1_text', 'slider_slide_1_cta1_href',
                    'slider_slide_1_cta2_text', 'slider_slide_1_cta2_href', 'slider_slide_1_color',
                    'slider_slide_1_icon', 'slider_slide_1_image',
                    'slider_slide_2_eyebrow', 'slider_slide_2_heading', 'slider_slide_2_highlight',
                    'slider_slide_2_subtitle', 'slider_slide_2_cta1_text', 'slider_slide_2_cta1_href',
                    'slider_slide_2_cta2_text', 'slider_slide_2_cta2_href', 'slider_slide_2_color',
                    'slider_slide_2_icon', 'slider_slide_2_image',
                    'slider_slide_3_eyebrow', 'slider_slide_3_heading', 'slider_slide_3_highlight',
                    'slider_slide_3_subtitle', 'slider_slide_3_cta1_text', 'slider_slide_3_cta1_href',
                    'slider_slide_3_cta2_text', 'slider_slide_3_cta2_href', 'slider_slide_3_color',
                    'slider_slide_3_icon', 'slider_slide_3_image',
                    'slider_slide_4_eyebrow', 'slider_slide_4_heading', 'slider_slide_4_highlight',
                    'slider_slide_4_subtitle', 'slider_slide_4_cta1_text', 'slider_slide_4_cta1_href',
                    'slider_slide_4_cta2_text', 'slider_slide_4_cta2_href', 'slider_slide_4_color',
                    'slider_slide_4_icon', 'slider_slide_4_image',
                    'slider_slide_5_eyebrow', 'slider_slide_5_heading', 'slider_slide_5_highlight',
                    'slider_slide_5_subtitle', 'slider_slide_5_cta1_text', 'slider_slide_5_cta1_href',
                    'slider_slide_5_cta2_text', 'slider_slide_5_cta2_href', 'slider_slide_5_color',
                    'slider_slide_5_icon', 'slider_slide_5_image',
                    'slider_slide_6_eyebrow', 'slider_slide_6_heading', 'slider_slide_6_highlight',
                    'slider_slide_6_subtitle', 'slider_slide_6_cta1_text', 'slider_slide_6_cta1_href',
                    'slider_slide_6_cta2_text', 'slider_slide_6_cta2_href', 'slider_slide_6_color',
                    'slider_slide_6_icon', 'slider_slide_6_image',
                    'self_registration',
                    'registration_email_domain',
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

                // Merge in any Feature cases added after the setting was last saved.
                // New top-level modules default to enabled so they appear in Feature Management.
                $saved = json_decode($stored, true) ?? [];
                $all = array_column(Feature::cases(), 'value');

                return array_values(array_unique(array_merge($saved, $all)));
            }),
            'disabled_sub_features' => Cache::remember('inertia_disabled_sub_features', 300, function () {
                $stored = AppSetting::where('key', 'disabled_sub_features')->value('value');

                // When no setting has ever been saved, default workflow sub-features to disabled.
                if ($stored === null) {
                    return [
                        'workflow.co_pi_acceptance',
                        'workflow.coi_declaration',
                        'workflow.budget_revision',
                        'workflow.no_cost_extension',
                        'workflow.sla_tracking',
                        'workflow.ethical_clearance',
                        'workflow.proposal_templates',
                        'workflow.closure_checklist',
                    ];
                }

                return json_decode($stored, true) ?? [];
            }),
        ];
    }
}
