<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ApplicationController extends Controller
{
    private const MANAGERS = ['super_admin', 'admin', 'research_officer', 'central_officer'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = ExternalFundApplication::with([
            'agency:id,name,acronym',
            'principalInvestigator:id,name,email',
            'college:id,name',
        ])
            ->withCount(['teamMembers', 'reviews', 'documents'])
            ->when($request->search, fn ($q, $s) => $q->where('title', 'like', "%{$s}%")
                ->orWhere('ref_number', 'like', "%{$s}%"))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->category, fn ($q, $c) => $q->where('category', $c))
            ->when($request->college_id, fn ($q, $id) => $q->where('college_id', $id))
            ->when(
                ! $user->hasAnyRole(self::MANAGERS),
                fn ($q) => $q->where('created_by', $user->id)
            )
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
        $data = $request->validate([
            'agency_id' => 'required|uuid|exists:ef_agencies,id',
            'opportunity_id' => 'nullable|uuid|exists:ef_opportunities,id',
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'department_id' => 'nullable|uuid|exists:departments,id',
            'pi_user_id' => 'nullable|uuid|exists:users,id',
            'title' => 'required|string|max:255',
            'donor_ref_number' => 'nullable|string|max:255',
            'category' => 'required|in:research,community_engagement,technology_transfer,innovation,other',
            'theme' => 'nullable|string|max:255',
            'abstract' => 'nullable|string',
            'goals_objectives' => 'nullable|string',
            'target_beneficiaries' => 'nullable|string',
            'remarks' => 'nullable|string',
            'partner_institutions' => 'nullable|string',
            'lead_institution' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:500',
            'amount_requested' => 'nullable|numeric|min:0',
            'annual_budget' => 'nullable|numeric|min:0',
            'hu_contribution' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'keywords' => 'nullable|array',
            'pi_name' => 'nullable|string|max:255',
            'pi_phone' => 'nullable|string|max:50',
            'pi_email' => 'nullable|email|max:255',
            'staff_count' => 'nullable|integer|min:0',
            'co_investigator_names' => 'nullable|string',
            'co_investigator_phones' => 'nullable|string',
            'co_investigator_emails' => 'nullable|string',
        ]);

        $data['pi_user_id'] = $data['pi_user_id'] ?? $request->user()->id;
        $data['created_by'] = $request->user()->id;
        $data['ref_number'] = $this->generateRefNumber($data['category']);

        $application = ExternalFundApplication::create($data);

        return response()->json([
            'data' => $application->fresh(['agency:id,name,acronym', 'principalInvestigator:id,name']),
            'message' => 'Application created.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $application = ExternalFundApplication::with([
            'agency',
            'opportunity:id,title,deadline',
            'principalInvestigator:id,name,email',
            'college:id,name',
            'department:id,name',
            'teamMembers.user:id,name,email',
            'budgets',
            'reviews.reviewer:id,name',
            'award',
            'documents.uploadedBy:id,name',
        ])->findOrFail($id);

        $user = $request->user();
        if (! $user->hasAnyRole(self::MANAGERS) && $application->created_by !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json(['data' => $application, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $application = ExternalFundApplication::findOrFail($id);
        $user = $request->user();

        if (! $user->hasAnyRole(self::MANAGERS) && $application->created_by !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'agency_id' => 'sometimes|uuid|exists:ef_agencies,id',
            'opportunity_id' => 'nullable|uuid|exists:ef_opportunities,id',
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'department_id' => 'nullable|uuid|exists:departments,id',
            'pi_user_id' => 'nullable|uuid|exists:users,id',
            'title' => 'sometimes|string|max:255',
            'donor_ref_number' => 'nullable|string|max:255',
            'category' => 'sometimes|in:research,community_engagement,technology_transfer,innovation,other',
            'theme' => 'nullable|string|max:255',
            'abstract' => 'nullable|string',
            'goals_objectives' => 'nullable|string',
            'target_beneficiaries' => 'nullable|string',
            'remarks' => 'nullable|string',
            'partner_institutions' => 'nullable|string',
            'lead_institution' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:500',
            'amount_requested' => 'nullable|numeric|min:0',
            'annual_budget' => 'nullable|numeric|min:0',
            'hu_contribution' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'keywords' => 'nullable|array',
            'pi_name' => 'nullable|string|max:255',
            'pi_phone' => 'nullable|string|max:50',
            'pi_email' => 'nullable|email|max:255',
            'staff_count' => 'nullable|integer|min:0',
            'co_investigator_names' => 'nullable|string',
            'co_investigator_phones' => 'nullable|string',
            'co_investigator_emails' => 'nullable|string',
        ]);

        $application->update($data);

        return response()->json(['data' => $application->fresh(), 'message' => 'Application updated.', 'errors' => [], 'meta' => []]);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(self::MANAGERS)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $application = ExternalFundApplication::findOrFail($id);

        $data = $request->validate([
            'status' => 'required|in:draft,under_internal_review,approved_for_submission,submitted,under_review,awarded,rejected,withdrawn',
        ]);

        if ($data['status'] === 'approved_for_submission') {
            $approvedCount = $application->reviews()
                ->whereIn('stage', ['department', 'college', 'research_office', 'management'])
                ->where('status', 'approved')
                ->count();

            if ($approvedCount < 4) {
                return response()->json([
                    'message' => "All 4 review stages must be approved before the application can advance. Currently {$approvedCount}/4 approved.",
                    'errors' => [],
                    'meta' => ['approved_count' => $approvedCount, 'required' => 4],
                ], 422);
            }
        }

        $application->update([
            'status' => $data['status'],
            'submitted_at' => $data['status'] === 'submitted' ? now() : $application->submitted_at,
        ]);

        return response()->json(['data' => $application->fresh(), 'message' => 'Status updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        ExternalFundApplication::findOrFail($id)->delete();

        return response()->json(['data' => null, 'message' => 'Application deleted.', 'errors' => [], 'meta' => []]);
    }

    private function generateRefNumber(string $category): string
    {
        $prefix = match ($category) {
            'research' => 'EF-RES',
            'community_engagement' => 'EF-COM',
            'technology_transfer' => 'EF-TT',
            'innovation' => 'EF-INN',
            default => 'EF-OTH',
        };

        return $prefix.'-'.date('Y').'-'.strtoupper(Str::random(6));
    }
}
