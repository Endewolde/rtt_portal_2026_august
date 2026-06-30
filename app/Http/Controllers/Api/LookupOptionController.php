<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LookupOption;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LookupOptionController extends Controller
{
    /** GET /lookup-options — returns all groups keyed by group name (admin view, includes inactive) */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionTo('lookup_options.view_any')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $grouped = LookupOption::orderBy('sort_order')
            ->orderBy('label')
            ->get()
            ->groupBy('group')
            ->map(fn ($items) => $items->values());

        return response()->json(['data' => $grouped, 'message' => 'OK.', 'errors' => []]);
    }

    /** GET /lookup-options/active — returns only active options, optimised for forms */
    public function active(): JsonResponse
    {
        $grouped = LookupOption::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get()
            ->groupBy('group')
            ->map(fn ($items) => $items->pluck('label')->values());

        return response()->json(['data' => $grouped, 'message' => 'OK.', 'errors' => []]);
    }

    /** POST /lookup-options */
    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionTo('lookup_options.create')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'group' => ['required', 'string', 'in:'.implode(',', array_keys(LookupOption::GROUPS))],
            'label' => ['required', 'string', 'max:120'],
        ]);

        $maxOrder = LookupOption::where('group', $validated['group'])->max('sort_order') ?? -1;

        $option = LookupOption::create([
            'group' => $validated['group'],
            'label' => trim($validated['label']),
            'sort_order' => $maxOrder + 1,
            'is_active' => true,
        ]);

        return response()->json(['data' => $option, 'message' => 'Option added.', 'errors' => []], 201);
    }

    /** PUT /lookup-options/{option} */
    public function update(Request $request, LookupOption $option): JsonResponse
    {
        if (! $request->user()?->hasPermissionTo('lookup_options.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'label' => ['sometimes', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['label'])) {
            $validated['label'] = trim($validated['label']);
        }

        $option->update($validated);

        return response()->json(['data' => $option->fresh(), 'message' => 'Option updated.', 'errors' => []]);
    }

    /** DELETE /lookup-options/{option} */
    public function destroy(Request $request, LookupOption $option): JsonResponse
    {
        if (! $request->user()?->hasPermissionTo('lookup_options.delete')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $option->delete();

        return response()->json(['data' => null, 'message' => 'Option deleted.', 'errors' => []]);
    }

    /** POST /lookup-options/reorder */
    public function reorder(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionTo('lookup_options.reorder')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'string', 'exists:lookup_options,id'],
        ]);

        foreach ($validated['ids'] as $index => $id) {
            LookupOption::where('id', $id)->update(['sort_order' => $index]);
        }

        return response()->json(['data' => null, 'message' => 'Reordered.', 'errors' => []]);
    }
}
