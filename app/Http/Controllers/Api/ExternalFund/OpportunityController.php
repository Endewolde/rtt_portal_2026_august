<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundOpportunity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OpportunityController extends Controller
{
    private const MANAGERS = ['super_admin', 'admin', 'research_officer', 'central_officer'];

    public function publicIndex(Request $request): JsonResponse
    {
        $query = ExternalFundOpportunity::with('agency:id,name,acronym,website,country,logo_path')
            ->where('status', 'open')
            ->when($request->search, fn ($q, $s) => $q->where('title', 'like', "%{$s}%")
                ->orWhere('ref_number', 'like', "%{$s}%"))
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->category, fn ($q, $c) => $q->where('category', $c))
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->orderByRaw('CASE WHEN is_featured = 1 THEN 0 ELSE 1 END')
            ->latest('deadline');

        $perPage = min((int) ($request->per_page ?? 12), 50);

        return response()->json([
            'data' => $query->paginate($perPage),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = ExternalFundOpportunity::with('agency:id,name,acronym')
            ->when($request->search, fn ($q, $s) => $q->where('title', 'like', "%{$s}%")
                ->orWhere('ref_number', 'like', "%{$s}%"))
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->category, fn ($q, $c) => $q->where('category', $c))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->latest('deadline');

        $perPage = min((int) ($request->per_page ?? 25), 100);

        return response()->json([
            'data' => $query->paginate($perPage),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(self::MANAGERS)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'agency_id' => 'required|uuid|exists:ef_agencies,id',
            'title' => 'required|string|max:255',
            'ref_number' => 'nullable|string|max:100',
            'category' => 'required|in:research,community_engagement,technology_transfer,innovation,other',
            'type' => 'required|in:grant,contract,fellowship,scholarship,other',
            'description' => 'nullable|string',
            'eligibility' => 'nullable|string',
            'amount_min' => 'nullable|numeric|min:0',
            'amount_max' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'opening_date' => 'nullable|date',
            'deadline' => 'nullable|date',
            'expected_notification_date' => 'nullable|date',
            'keywords' => 'nullable|array',
            'status' => 'required|in:draft,open,closed,cancelled',
            'is_featured' => 'boolean',
        ]);

        $data['created_by'] = $request->user()->id;
        $opportunity = ExternalFundOpportunity::create($data);

        return response()->json([
            'data' => $opportunity->load('agency:id,name,acronym'),
            'message' => 'Opportunity created.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $opportunity = ExternalFundOpportunity::with(['agency', 'createdBy:id,name'])
            ->withCount('applications')
            ->findOrFail($id);

        return response()->json(['data' => $opportunity, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(self::MANAGERS)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $opportunity = ExternalFundOpportunity::findOrFail($id);

        $data = $request->validate([
            'agency_id' => 'sometimes|uuid|exists:ef_agencies,id',
            'title' => 'sometimes|string|max:255',
            'ref_number' => 'nullable|string|max:100',
            'category' => 'sometimes|in:research,community_engagement,technology_transfer,innovation,other',
            'type' => 'sometimes|in:grant,contract,fellowship,scholarship,other',
            'description' => 'nullable|string',
            'eligibility' => 'nullable|string',
            'amount_min' => 'nullable|numeric|min:0',
            'amount_max' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'opening_date' => 'nullable|date',
            'deadline' => 'nullable|date',
            'expected_notification_date' => 'nullable|date',
            'keywords' => 'nullable|array',
            'status' => 'sometimes|in:draft,open,closed,cancelled',
            'is_featured' => 'boolean',
        ]);

        $opportunity->update($data);

        return response()->json(['data' => $opportunity->fresh('agency:id,name,acronym'), 'message' => 'Opportunity updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ExternalFundOpportunity::findOrFail($id)->delete();

        return response()->json(['data' => null, 'message' => 'Opportunity deleted.', 'errors' => [], 'meta' => []]);
    }
}
