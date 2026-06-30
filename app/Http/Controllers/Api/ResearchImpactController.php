<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ResearchImpact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResearchImpactController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionTo('research_impacts.view_any')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $query = ResearchImpact::with([
            'proposal:id,tracker_number,title,category',
            'recorder:id,name',
        ])->orderByDesc('year')->orderByDesc('created_at');

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }
        if ($year = $request->query('year')) {
            $query->where('year', $year);
        }
        if ($proposalId = $request->query('proposal_id')) {
            $query->where('proposal_id', $proposalId);
        }
        if ($q = $request->query('q')) {
            $query->where(fn ($s) => $s->where('title', 'like', "%{$q}%")
                ->orWhere('authors', 'like', "%{$q}%")
                ->orWhere('journal_or_venue', 'like', "%{$q}%")
            );
        }

        $perPage = min((int) ($request->query('per_page', 20)), 100);

        $stats = [
            'by_type' => ResearchImpact::selectRaw('type, COUNT(*) as count')
                ->groupBy('type')
                ->pluck('count', 'type'),
            'by_year' => ResearchImpact::selectRaw('year, COUNT(*) as count')
                ->whereNotNull('year')
                ->groupBy('year')
                ->orderByDesc('year')
                ->pluck('count', 'year'),
            'total' => ResearchImpact::count(),
        ];

        return response()->json([
            'data' => $query->paginate($perPage),
            'message' => 'Research impacts retrieved.',
            'errors' => [],
            'meta' => ['stats' => $stats],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasPermissionTo('research_impacts.create')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'proposal_id' => ['required', 'exists:proposals,id'],
            'type' => ['required', 'in:publication,patent,citation,award,conference,technology,other'],
            'title' => ['required', 'string', 'max:500'],
            'authors' => ['nullable', 'string', 'max:500'],
            'journal_or_venue' => ['nullable', 'string', 'max:255'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'doi_or_url' => ['nullable', 'string', 'max:500'],
            'impact_factor' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:2000'],
            'metadata' => ['nullable', 'array'],
        ]);

        $impact = ResearchImpact::create([
            ...$validated,
            'recorded_by' => $user->id,
        ]);

        $impact->load(['proposal:id,tracker_number,title', 'recorder:id,name']);

        return response()->json(['data' => $impact, 'message' => 'Impact recorded.', 'errors' => []], 201);
    }

    public function update(Request $request, ResearchImpact $researchImpact): JsonResponse
    {
        if (! $request->user()?->hasPermissionTo('research_impacts.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'type' => ['sometimes', 'in:publication,patent,citation,award,conference,technology,other'],
            'title' => ['sometimes', 'string', 'max:500'],
            'authors' => ['nullable', 'string', 'max:500'],
            'journal_or_venue' => ['nullable', 'string', 'max:255'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'doi_or_url' => ['nullable', 'string', 'max:500'],
            'impact_factor' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:2000'],
            'metadata' => ['nullable', 'array'],
        ]);

        $researchImpact->update($validated);
        $researchImpact->load(['proposal:id,tracker_number,title', 'recorder:id,name']);

        return response()->json(['data' => $researchImpact, 'message' => 'Impact updated.', 'errors' => []]);
    }

    public function destroy(Request $request, ResearchImpact $researchImpact): JsonResponse
    {
        if (! $request->user()?->hasPermissionTo('research_impacts.delete')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $researchImpact->delete();

        return response()->json(['data' => null, 'message' => 'Impact deleted.', 'errors' => []]);
    }
}
