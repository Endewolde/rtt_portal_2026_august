<?php

namespace App\Http\Controllers\Api;

use App\Enums\Feature;
use App\Http\Controllers\Controller;
use App\Services\FeatureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeatureController extends Controller
{
    public function __construct(private readonly FeatureService $featureService) {}

    /** List all features with their enabled/disabled status. */
    public function index(): JsonResponse
    {
        $enabled = $this->featureService->getEnabledFeatures();

        $features = array_map(fn (Feature $f) => [
            'slug'        => $f->value,
            'label'       => $f->label(),
            'description' => $f->description(),
            'enabled'     => in_array($f->value, $enabled),
        ], Feature::cases());

        return response()->json([
            'data'    => $features,
            'message' => 'Features retrieved.',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    /** Toggle individual feature on or off (super_admin only). */
    public function toggle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slug'    => ['required', 'string', 'in:' . implode(',', array_column(Feature::cases(), 'value'))],
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
            'data'    => ['enabled_features' => array_values($updated)],
            'message' => 'Feature updated.',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    /** Replace entire set of enabled features at once (super_admin only). */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'features'   => ['required', 'array'],
            'features.*' => ['string', 'in:' . implode(',', array_column(Feature::cases(), 'value'))],
        ]);

        $this->featureService->setEnabledFeatures($validated['features']);

        return response()->json([
            'data'    => ['enabled_features' => array_values($validated['features'])],
            'message' => 'Feature configuration saved.',
            'errors'  => [],
            'meta'    => [],
        ]);
    }
}
