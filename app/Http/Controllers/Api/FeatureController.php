<?php

namespace App\Http\Controllers\Api;

use App\Enums\Feature;
use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Services\FeatureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class FeatureController extends Controller
{
    public function __construct(private readonly FeatureService $featureService) {}

    /** List all features with their enabled/disabled status. */
    public function index(): JsonResponse
    {
        $enabled = $this->featureService->getEnabledFeatures();

        $features = array_map(fn (Feature $f) => [
            'slug' => $f->value,
            'label' => $f->label(),
            'description' => $f->description(),
            'enabled' => in_array($f->value, $enabled),
        ], Feature::cases());

        return response()->json([
            'data' => $features,
            'message' => 'Features retrieved.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Toggle individual feature on or off (super_admin only). */
    public function toggle(Request $request): JsonResponse
    {
        if (! $request->user()?->can('features.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $validated = $request->validate([
            'slug' => ['required', 'string', 'in:'.implode(',', array_column(Feature::cases(), 'value'))],
            'enabled' => ['required', 'boolean'],
        ]);

        $current = $this->featureService->getEnabledFeatures();

        if ($validated['enabled']) {
            $updated = array_unique([...$current, $validated['slug']]);
        } else {
            $updated = array_values(array_filter($current, fn ($f) => $f !== $validated['slug']));
        }

        $this->featureService->setEnabledFeatures($updated);

        return response()->json([
            'data' => ['enabled_features' => array_values($updated)],
            'message' => 'Feature updated.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Replace entire set of enabled features at once (super_admin only). */
    public function update(Request $request): JsonResponse
    {
        if (! $request->user()?->can('features.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $validated = $request->validate([
            'features' => ['present', 'array'],
            'features.*' => ['string', 'in:'.implode(',', array_column(Feature::cases(), 'value'))],
        ]);

        $this->featureService->setEnabledFeatures($validated['features'] ?? []);

        return response()->json([
            'data' => ['enabled_features' => array_values($validated['features'])],
            'message' => 'Feature configuration saved.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Workflow sub-feature slugs that must be off until the admin explicitly enables them. */
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

    /** Get the list of explicitly disabled sub-features. */
    public function getDisabledSubFeatures(): JsonResponse
    {
        $stored = AppSetting::where('key', 'disabled_sub_features')->value('value');

        if ($stored === null) {
            // First-time: all workflow sub-features are off by default.
            $disabled = self::WORKFLOW_DEFAULTS_DISABLED;
        } else {
            $disabled = json_decode($stored, true) ?? [];
        }

        return response()->json([
            'data' => $disabled,
            'message' => 'Sub-feature configuration retrieved.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Replace the full list of disabled sub-features. */
    public function updateDisabledSubFeatures(Request $request): JsonResponse
    {
        if (! $request->user()?->can('features.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $request->validate([
            'disabled' => ['present', 'array'],
            'disabled.*' => ['string'],
        ]);

        $disabled = array_values($request->input('disabled', []));

        AppSetting::updateOrCreate(
            ['key' => 'disabled_sub_features'],
            ['value' => json_encode($disabled)]
        );

        Cache::forget('inertia_disabled_sub_features');
        Cache::forget('global:disabled_sub_features');

        return response()->json([
            'data' => $disabled,
            'message' => 'Sub-feature configuration saved.',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
