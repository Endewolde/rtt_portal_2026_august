<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ThematicArea;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ThematicAreaController extends Controller
{
    /** Public, unauthenticated — active areas only. */
    public function publicIndex(): JsonResponse
    {
        return response()->json([
            'data' => ThematicArea::active()->ordered()->get(),
        ]);
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ThematicArea::ordered()->get(),
            'message' => 'Thematic areas retrieved.',
            'errors' => [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->can('thematic_areas.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:thematic_areas,name'],
            'description' => ['nullable', 'string', 'max:1000'],
            'sub_topics' => ['nullable', 'array'],
            'sub_topics.*' => ['string', 'max:500'],
            'icon' => ['nullable', 'string', 'max:10'],
            'color' => ['nullable', 'string', 'max:20'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $area = ThematicArea::create($validated);

        return response()->json(['data' => $area, 'message' => 'Thematic area created.'], 201);
    }

    public function update(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('thematic_areas.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $area = ThematicArea::findOrFail($id);
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', 'unique:thematic_areas,name,'.$area->id],
            'description' => ['nullable', 'string', 'max:1000'],
            'sub_topics' => ['nullable', 'array'],
            'sub_topics.*' => ['string', 'max:500'],
            'icon' => ['nullable', 'string', 'max:20'],
            'color' => ['nullable', 'string', 'max:20'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $area->update($validated);

        return response()->json(['data' => $area->fresh(), 'message' => 'Thematic area updated.']);
    }

    public function destroy(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('thematic_areas.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ThematicArea::findOrFail($id)->delete();

        return response()->json(['message' => 'Thematic area deleted.']);
    }
}
