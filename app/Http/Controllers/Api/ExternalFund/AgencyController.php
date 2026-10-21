<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundAgency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgencyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ExternalFundAgency::query()
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%")
                ->orWhere('acronym', 'like', "%{$s}%"))
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->withCount(['opportunities', 'applications', 'awards'])
            ->latest();

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
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'acronym' => 'nullable|string|max:20',
            'type' => 'required|in:government,ngo,international,industry,foundation,other',
            'country' => 'nullable|string|max:100',
            'website' => 'nullable|url|max:255',
            'description' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'contact_phone' => 'nullable|string|max:50',
            'is_active' => 'boolean',
        ]);

        $data['created_by'] = $request->user()->id;
        $agency = ExternalFundAgency::create($data);

        return response()->json([
            'data' => $agency,
            'message' => 'Agency created successfully.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $agency = ExternalFundAgency::withCount(['opportunities', 'applications', 'awards'])
            ->findOrFail($id);

        return response()->json(['data' => $agency, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $agency = ExternalFundAgency::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'acronym' => 'nullable|string|max:20',
            'type' => 'sometimes|in:government,ngo,international,industry,foundation,other',
            'country' => 'nullable|string|max:100',
            'website' => 'nullable|url|max:255',
            'description' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'contact_phone' => 'nullable|string|max:50',
            'is_active' => 'boolean',
        ]);

        $agency->update($data);

        return response()->json(['data' => $agency->fresh(), 'message' => 'Agency updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.delete')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $agency = ExternalFundAgency::findOrFail($id);
        $agency->delete();

        return response()->json(['data' => null, 'message' => 'Agency deleted.', 'errors' => [], 'meta' => []]);
    }
}
