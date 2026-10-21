<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundAward;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AwardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ExternalFundAward::with([
            'agency:id,name,acronym',
            'application:id,title,ref_number,pi_user_id',
            'application.principalInvestigator:id,name',
        ])
            ->withCount(['expenditures', 'milestones'])
            ->when($request->search, fn ($q, $s) => $q->where('title', 'like', "%{$s}%")
                ->orWhere('award_number', 'like', "%{$s}%"))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
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
            'application_id' => 'required|uuid|exists:ef_applications,id',
            'title' => 'required|string|max:255',
            'amount_awarded' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'status' => 'required|in:active,completed,suspended,terminated',
            'conditions' => 'nullable|string',
            'signed_at' => 'nullable|date',
        ]);

        $application = ExternalFundApplication::findOrFail($data['application_id']);
        $data['agency_id'] = $application->agency_id;
        $data['award_number'] = 'AWD-'.date('Y').'-'.strtoupper(Str::random(6));
        $data['created_by'] = $request->user()->id;

        $award = ExternalFundAward::create($data);
        $application->update(['status' => 'awarded']);

        return response()->json([
            'data' => $award->load('agency:id,name,acronym'),
            'message' => 'Award recorded successfully.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $award = ExternalFundAward::with([
            'agency',
            'application.principalInvestigator:id,name,email',
            'application.college:id,name',
            'expenditures',
            'milestones',
            'budgets',
            'documents.uploadedBy:id,name',
            'approvedBy:id,name',
        ])->findOrFail($id);

        return response()->json(['data' => $award, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $award = ExternalFundAward::findOrFail($id);

        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'amount_awarded' => 'sometimes|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date',
            'status' => 'sometimes|in:active,completed,suspended,terminated',
            'conditions' => 'nullable|string',
            'signed_at' => 'nullable|date',
            'approved_by' => 'nullable|uuid|exists:users,id',
        ]);

        $award->update($data);

        return response()->json(['data' => $award->fresh(), 'message' => 'Award updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.delete')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ExternalFundAward::findOrFail($id)->delete();

        return response()->json(['data' => null, 'message' => 'Award deleted.', 'errors' => [], 'meta' => []]);
    }
}
