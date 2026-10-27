<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Support\Programmes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The organisation's funding programmes (Settings → Programmes). A programme's key
 * never changes once proposals use it; it can be renamed, recoloured or switched
 * off, and removed only while nothing uses it.
 */
class ProgrammeController extends Controller
{
    /** Everyone signed in may read the list — forms and filters are built from it. */
    public function index(): JsonResponse
    {
        $usage = Proposal::whereNull('deleted_at')->selectRaw('category, COUNT(*) as n')->groupBy('category')->pluck('n', 'category');

        return response()->json(['data' => Programme::orderBy('sort_order')->orderBy('name')->get()->map(fn (Programme $p) => $p->toArray() + [
            'proposals' => (int) ($usage[$p->key] ?? 0),
            'director_roles' => Programmes::directorRoles($p->key),
        ]), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->can('programmes.manage')) {
            return $this->forbidden();
        }

        $data = $this->validated($request);
        $data['key'] = $this->uniqueKey($request->input('key') ?: $data['name']);
        $data['sort_order'] ??= (int) Programme::max('sort_order') + 1;
        $programme = Programme::create($data);

        return response()->json(['data' => $programme, 'message' => "{$programme->name} added. Create a role scoped to it on the Roles page to give it a director.", 'errors' => []], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('programmes.manage')) {
            return $this->forbidden();
        }

        $programme = Programme::findOrFail($id);
        $programme->update($this->validated($request, $programme));

        return response()->json(['data' => $programme->fresh(), 'message' => 'Programme updated.', 'errors' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('programmes.manage')) {
            return $this->forbidden();
        }

        $programme = Programme::findOrFail($id);
        if (Proposal::withTrashed()->where('category', $programme->key)->exists() || ProposalCall::where('category', $programme->key)->exists()) {
            return response()->json(['data' => null, 'message' => 'Proposals or calls use this programme, so it cannot be removed. Switch it off instead.', 'errors' => []], 422);
        }

        $programme->delete();

        return response()->json(['data' => null, 'message' => 'Programme removed.', 'errors' => []]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Programme $programme = null): array
    {
        return $request->validate([
            'name' => [$programme ? 'sometimes' : 'required', 'string', 'max:120'],
            'tracker_prefix' => [$programme ? 'sometimes' : 'required', 'string', 'regex:/^[A-Z]{2,6}$/',
                Rule::unique('programmes', 'tracker_prefix')->ignore($programme?->id)],
            'description' => ['nullable', 'string', 'max:500'],
            'color' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ], ['tracker_prefix.regex' => 'The tracker prefix is 2–6 capital letters, e.g. RES or PHD.']);
    }

    private function uniqueKey(string $source): string
    {
        $base = Str::of($source)->lower()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_')->limit(40, '')->toString() ?: 'programme';
        $key = $base;
        for ($i = 2; Programme::where('key', $key)->exists(); $i++) {
            $key = "{$base}_{$i}";
        }

        return $key;
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
    }
}
