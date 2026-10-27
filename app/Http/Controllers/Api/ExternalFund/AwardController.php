<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundAward;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
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
            ->withSum('expenditures', 'amount')
            ->visibleTo($request->user())
            ->when($request->search, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%{$s}%")
                ->orWhere('award_number', 'like', "%{$s}%")))
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

        if ($application->award()->exists()) {
            return response()->json(['message' => 'This application already has an award. Open it to change the amount or dates.', 'errors' => []], 422);
        }
        if (! in_array($application->status, ['submitted', 'under_review'], true)) {
            return response()->json([
                'message' => 'Only an application that has been submitted to the donor can be awarded — this one is '.str_replace('_', ' ', $application->status).'.',
                'errors' => [],
            ], 422);
        }

        $data['agency_id'] = $application->agency_id;
        $data['currency'] = $data['currency'] ?? $application->currency;
        $data['award_number'] = 'AWD-'.date('Y').'-'.strtoupper(Str::random(6));
        $data['created_by'] = $request->user()->id;

        $award = DB::transaction(function () use ($data, $application) {
            $award = ExternalFundAward::create($data);
            $application->update(['status' => 'awarded']);
            // The budget lines proposed in the application become the award's budget.
            $application->budgets()->whereNull('award_id')->update(['award_id' => $award->id]);

            return $award;
        });

        return response()->json([
            'data' => $award->load('agency:id,name,acronym'),
            'message' => 'Award recorded successfully.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
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

        if (! $award->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

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

        $start = $data['start_date'] ?? $award->start_date;
        $end = $data['end_date'] ?? $award->end_date;
        if ($start && $end && Carbon::parse($end)->lte(Carbon::parse($start))) {
            return response()->json(['message' => 'The end date must be after the start date.', 'errors' => ['end_date' => ['The end date must be after the start date.']]], 422);
        }

        $spent = (float) $award->expenditures()->sum('amount');
        if (isset($data['amount_awarded']) && (float) $data['amount_awarded'] < $spent) {
            $message = 'The award cannot be less than what has already been spent ('.number_format($spent, 2).').';

            return response()->json(['message' => $message, 'errors' => ['amount_awarded' => [$message]]], 422);
        }

        $award->update($data);

        return response()->json(['data' => $award->fresh(), 'message' => 'Award updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.delete')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $award = ExternalFundAward::findOrFail($id);
        DB::transaction(function () use ($award) {
            // The application goes back to awaiting the donor's decision, so it can be awarded again correctly.
            $award->application?->update(['status' => 'under_review']);
            $award->delete();
        });

        return response()->json(['data' => null, 'message' => 'Award deleted.', 'errors' => [], 'meta' => []]);
    }
}
