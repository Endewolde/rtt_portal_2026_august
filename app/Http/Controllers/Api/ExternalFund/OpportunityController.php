<?php

namespace App\Http\Controllers\Api\ExternalFund;

use App\Http\Controllers\Controller;
use App\Models\ExternalFundOpportunity;
use App\Services\OpportunityMatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class OpportunityController extends Controller
{
    public function publicIndex(Request $request): JsonResponse
    {
        $query = ExternalFundOpportunity::with('agency:id,name,acronym,website,country,logo_path')
            ->where('status', 'open')
            ->when($request->search, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%{$s}%")
                ->orWhere('ref_number', 'like', "%{$s}%")))
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
            ->when($request->search, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%{$s}%")
                ->orWhere('ref_number', 'like', "%{$s}%")))
            ->when($request->agency_id, fn ($q, $id) => $q->where('agency_id', $id))
            ->when($request->category, fn ($q, $c) => $q->where('category', $c))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when(
                ! $request->user()->can('external_funds.manage') && ! $request->user()->can('external_funds.view_any'),
                fn ($q) => $q->where('status', 'open')
            )
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
        if (! $request->user()?->can('external_funds.manage')) {
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

        if ($invalid = $this->rangeErrors($data)) {
            return $invalid;
        }

        $data['created_by'] = $request->user()->id;
        $opportunity = ExternalFundOpportunity::create($data);
        $this->alertMatchingResearchers($opportunity);

        return response()->json([
            'data' => $opportunity->load('agency:id,name,acronym'),
            'message' => 'Opportunity created.',
            'errors' => [],
            'meta' => [],
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $opportunity = ExternalFundOpportunity::with(['agency', 'createdBy:id,name'])
            ->withCount('applications')
            ->findOrFail($id);

        if ($opportunity->status !== 'open' && ! $request->user()?->can('external_funds.manage') && ! $request->user()?->can('external_funds.view_any')) {
            abort(404);
        }

        return response()->json(['data' => $opportunity, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.manage')) {
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

        if ($invalid = $this->rangeErrors($data + [
            'amount_min' => $opportunity->amount_min, 'amount_max' => $opportunity->amount_max,
            'opening_date' => $opportunity->opening_date, 'deadline' => $opportunity->deadline,
        ])) {
            return $invalid;
        }

        $opportunity->update($data);
        $this->alertMatchingResearchers($opportunity);

        return response()->json(['data' => $opportunity->fresh('agency:id,name,acronym'), 'message' => 'Opportunity updated.', 'errors' => [], 'meta' => []]);
    }

    /**
     * The amount range and the dates must make sense together.
     *
     * @param  array<string, mixed>  $data
     */
    private function rangeErrors(array $data): ?JsonResponse
    {
        $errors = [];
        if (isset($data['amount_min'], $data['amount_max']) && (float) $data['amount_max'] < (float) $data['amount_min']) {
            $errors['amount_max'] = ['The maximum amount cannot be less than the minimum.'];
        }
        if (! empty($data['opening_date']) && ! empty($data['deadline']) && Carbon::parse($data['deadline'])->lt(Carbon::parse($data['opening_date']))) {
            $errors['deadline'] = ['The deadline cannot be before the opening date.'];
        }

        return $errors ? response()->json(['message' => collect($errors)->flatten()->first(), 'errors' => $errors], 422) : null;
    }

    /** Open opportunities matched to the signed-in researcher's own work, best first. */
    public function recommended(Request $request, OpportunityMatchService $matcher): JsonResponse
    {
        $matches = $matcher->forUser($request->user())->map(fn ($m) => [
            'id' => $m['opportunity']->id,
            'title' => $m['opportunity']->title,
            'agency' => $m['opportunity']->agency?->acronym ?: $m['opportunity']->agency?->name,
            'category' => $m['opportunity']->category,
            'type' => $m['opportunity']->type,
            'deadline' => $m['opportunity']->deadline?->toDateString(),
            'amount_max' => $m['opportunity']->amount_max,
            'currency' => $m['opportunity']->currency,
            'reasons' => array_slice($m['reasons'], 0, 3),
        ]);

        return response()->json(['data' => $matches->values(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** Once an opportunity is open, researchers whose work matches hear about it (once), after the response. */
    private function alertMatchingResearchers(ExternalFundOpportunity $opportunity): void
    {
        if ($opportunity->status !== 'open' || $opportunity->match_alerts_sent_at) {
            return;
        }

        $id = $opportunity->id;
        dispatch(function () use ($id) {
            if ($fresh = ExternalFundOpportunity::find($id)) {
                app(OpportunityMatchService::class)->alertFor($fresh);
            }
        })->afterResponse();
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('external_funds.delete')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $opportunity = ExternalFundOpportunity::withCount('applications')->findOrFail($id);
        if ($opportunity->applications_count) {
            return response()->json(['message' => 'Applications were made under this opportunity. Close or cancel it instead of deleting it.', 'errors' => []], 422);
        }
        $opportunity->delete();

        return response()->json(['data' => null, 'message' => 'Opportunity deleted.', 'errors' => [], 'meta' => []]);
    }
}
