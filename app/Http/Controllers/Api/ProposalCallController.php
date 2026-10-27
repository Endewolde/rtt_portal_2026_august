<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProposalCallResource;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\ProposalCallService;
use App\Support\ApplicationForm;
use App\Support\Programmes;
use App\Support\ReviewRoute;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProposalCallController extends Controller
{
    public function __construct(private readonly ProposalCallService $service) {}

    /**
     * All calls for admin dashboard — includes drafts and expired, with submission counts.
     * Requires proposal_calls.view_any permission.
     */
    /**
     * proposals_count = proposals actually submitted to the call (drafts excluded),
     * limited to what the viewer can see — the same set the call's Submissions page
     * lists, so the two numbers always agree.
     */
    private function withSubmittedCount(Builder $query, ?User $user): Builder
    {
        $scope = $user?->accessScope();
        $directorCategories = $scope?->isCategory() ? $scope->categories : [];
        $collegeId = $scope?->isCollege() ? $scope->collegeId : null;

        return $query->withCount(['proposals as proposals_count' => fn ($q) => $q
            ->where('status', '!=', 'draft')
            ->when($directorCategories !== [], fn ($q) => $q->whereIn('category', $directorCategories))
            ->when($collegeId, fn ($q) => $q->where('college_id', $collegeId)),
        ]);
    }

    /**
     * Every proposal submitted to one call (drafts are only counted), with the
     * figures for the call's submissions page. Visibility follows the main proposal
     * list: college officers see their college, category officers their category.
     */
    public function submissions(string $id, Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('proposal_calls.view_submissions')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);

        $scoped = Proposal::query()
            ->where('proposal_call_id', $call->id)
            ->when($request->_college_scope, fn ($q, $collegeId) => $q->where('college_id', $collegeId))
            ->when($request->_category_scope, fn ($q, $category) => $q->where('category', $category));

        $draftCount = (clone $scoped)->where('status', 'draft')->count();

        $proposals = (clone $scoped)
            ->where('status', '!=', 'draft')
            ->with(['pi:id,name,email', 'college:id,name', 'department:id,name'])
            ->withCount([
                'reviewAssignments as reviews_total' => fn ($q) => $q->whereNotIn('status', ['declined', 'cancelled']),
                'reviewAssignments as reviews_submitted' => fn ($q) => $q->where('status', 'submitted'),
            ])
            ->orderByDesc('submitted_at')
            ->orderByDesc('created_at')
            ->get([
                'id', 'tracker_number', 'title', 'category', 'status', 'pi_user_id', 'college_id',
                'department_id', 'academic_year', 'submitted_at', 'status_entered_at', 'created_at', 'updated_at',
                'anonymity_status',
            ]);

        return response()->json([
            'data' => [
                'call' => (new ProposalCallResource($call))->resolve(),
                'proposals' => $proposals,
                'stats' => [
                    'submitted' => $proposals->count(),
                    'drafts' => $draftCount,
                    'by_status' => $proposals->countBy('status'),
                    'by_college' => $proposals->groupBy(fn ($p) => $p->college?->name ?? 'Unassigned')
                        ->map->count()
                        ->sortDesc(),
                ],
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function allForAdmin(Request $request): AnonymousResourceCollection|JsonResponse
    {
        if (! $request->user()?->can('proposal_calls.view_any')) {
            return response()->json(['data' => [], 'message' => 'Forbidden.', 'errors' => [], 'meta' => []], 403);
        }

        $calls = $this->withSubmittedCount(ProposalCall::query(), $request->user())
            ->when($request->search, fn ($q) => $q->where('title', 'like', '%'.$request->search.'%'))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->category, fn ($q) => $q->where('category', $request->category))
            ->orderByDesc('created_at')
            ->paginate(25);

        return ProposalCallResource::collection($calls);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user?->can('proposal_calls.view_drafts')) {
            // Admins see all calls including drafts/expired, with submission counts
            $calls = $this->withSubmittedCount(ProposalCall::query(), $user)
                ->orderByDesc('created_at')
                ->paginate(20);
        } else {
            // PIs, reviewers, guests — only active calls that haven't expired
            $calls = ProposalCall::where('status', 'active')
                ->where('end_date', '>=', now())
                ->when($request->category, fn ($q) => $q->where('category', $request->category))
                ->when($request->academic_year, fn ($q) => $q->where('academic_year', $request->academic_year))
                ->orderBy('end_date', 'asc')
                ->get();
        }

        return response()->json([
            'data' => ProposalCallResource::collection($calls),
            'message' => 'Proposal calls retrieved.',
            'errors' => [],
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $call = ProposalCall::where('slug', $slug)->firstOrFail();

        return response()->json([
            'data' => new ProposalCallResource($call),
            'message' => 'Proposal call retrieved.',
            'errors' => [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.create')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'academic_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'category' => ['required', 'string', Rule::in(Programmes::keys(true))],
            'title' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'eligibility' => ['nullable', 'string'],
            'start_date' => ['required', 'date_format:Y-m-d\TH:i'],
            'end_date' => ['required', 'date_format:Y-m-d\TH:i', 'after:start_date'],
            'max_proposals_per_pi' => ['nullable', 'integer', 'min:1'],
            'funding_budget' => ['nullable', 'numeric', 'min:0', 'max:9999999999999'],
        ]);

        $call = $this->service->create($validated, $user);

        return response()->json([
            'data' => new ProposalCallResource($call),
            'message' => 'Proposal call created.',
            'errors' => [],
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:500'],
            'description' => ['sometimes', 'nullable', 'string'],
            'eligibility' => ['sometimes', 'nullable', 'string'],
            'start_date' => ['sometimes', 'date_format:Y-m-d\TH:i'],
            'end_date' => ['sometimes', 'date_format:Y-m-d\TH:i', 'after:start_date'],
            'category' => ['sometimes', 'string', Rule::in(Programmes::keys())],
            'academic_year' => ['sometimes', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'max_proposals_per_pi' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'funding_budget' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999999999999'],
        ]);

        try {
            $call = $this->service->update($call, $validated, $user);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json([
            'data' => new ProposalCallResource($call),
            'message' => 'Proposal call updated.',
            'errors' => [],
        ]);
    }

    /**
     * Set the call's own questions and documents (Calls → Application form). Answers
     * already given to a question that is removed stay on the proposal but are no
     * longer shown or required.
     */
    public function updateApplicationForm(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);
        $call->update(['application_form' => ApplicationForm::clean($request->validate(ApplicationForm::rules()))]);

        return response()->json([
            'data' => new ProposalCallResource($call->fresh()),
            'message' => $call->application_form ? 'Application form saved.' : 'Application form cleared — applicants see only the standard questions.',
            'errors' => [],
        ]);
    }

    /**
     * The call's review route alongside the organisation's standard pass marks, so
     * the editor can show what an empty field falls back to.
     */
    public function reviewRoute(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('proposal_calls.view_any')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);
        $standard = DB::table('threshold_settings')->whereIn('key', ReviewRoute::THRESHOLD_KEYS)->pluck('value', 'key')->map(fn ($v) => (float) $v);
        $maxPoints = DB::table('evaluation_types')
            ->join('evaluation_categories', 'evaluation_categories.evaluation_type_id', '=', 'evaluation_types.id')
            ->where('evaluation_types.proposal_category', $call->category)
            ->where('evaluation_types.is_active', true)
            ->where(fn ($q) => $q->where('evaluation_types.name', 'like', 'blind_review%')->orWhere('evaluation_types.name', 'like', 'open_defence%'))
            ->selectRaw("CASE WHEN evaluation_types.name LIKE 'blind_review%' THEN 'blind' ELSE 'defence' END as phase, SUM(evaluation_categories.weight) as total")
            ->groupBy('phase')
            ->pluck('total', 'phase');

        return response()->json([
            'data' => [
                'route' => ReviewRoute::for($call),
                'customised' => $call->review_route !== null,
                'standard' => $standard,
                'max_points' => ['blind' => (float) ($maxPoints['blind'] ?? 0), 'defence' => (float) ($maxPoints['defence'] ?? 0)],
                'proposals_in_review' => $call->proposals()->whereIn('status', ['under_blind_review', 'blind_review_passed', 'under_open_defence'])->count(),
            ],
            'message' => '',
            'errors' => [],
        ]);
    }

    /**
     * Set the call's review route. It applies to decisions not yet made — proposals
     * already decided keep their recorded outcome.
     */
    public function updateReviewRoute(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);
        $call->update(['review_route' => ReviewRoute::clean($request->validate(ReviewRoute::rules()))]);

        return response()->json([
            'data' => new ProposalCallResource($call->fresh()),
            'message' => $call->review_route ? 'Review route saved.' : 'This call now follows the standard review route.',
            'errors' => [],
        ]);
    }

    /** A new draft call started from this one, for the next academic year. */
    public function copy(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('proposal_calls.create')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $source = ProposalCall::findOrFail($id);
        $validated = $request->validate([
            'academic_year' => ['nullable', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'title' => ['nullable', 'string', 'max:500'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after:start_date'],
        ]);

        $call = $this->service->copy($source, array_filter($validated), $request->user());

        return response()->json([
            'data' => new ProposalCallResource($call),
            'message' => 'Call copied as a draft. Check the dates and details, then activate it.',
            'errors' => [],
        ], 201);
    }

    public function activate(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);

        try {
            $call = $this->service->activate($call);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json([
            'data' => new ProposalCallResource($call),
            'message' => 'Proposal call activated.',
            'errors' => [],
        ]);
    }

    public function close(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = $this->service->close(ProposalCall::findOrFail($id));

        return response()->json([
            'data' => new ProposalCallResource($call),
            'message' => 'Proposal call closed.',
            'errors' => [],
        ]);
    }

    public function reopen(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);

        try {
            $call = $this->service->reopen($call);
        } catch (\Exception $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json([
            'data' => new ProposalCallResource($call),
            'message' => 'Proposal call reopened successfully.',
            'errors' => [],
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $call = ProposalCall::findOrFail($id);

        if (! $request->user()?->can('proposal_calls.delete')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        if ($call->status === 'active') {
            return response()->json([
                'data' => null,
                'message' => 'Active proposal calls cannot be deleted. Close the call first.',
                'errors' => [],
            ], 422);
        }

        $submissionsCount = Proposal::where('proposal_call_id', $call->id)
            ->whereNotIn('status', ['draft'])
            ->count();

        if ($submissionsCount > 0) {
            return response()->json([
                'data' => null,
                'message' => "Cannot delete — this call has {$submissionsCount} submitted proposal(s).",
                'errors' => [],
            ], 422);
        }

        $call->delete();

        return response()->json([
            'data' => null,
            'message' => 'Proposal call deleted successfully.',
            'errors' => [],
        ]);
    }

    public function uploadGuidelines(Request $request, string $id): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:pdf|max:10240']);

        if (! $request->user()?->can('proposal_calls.update')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $call = ProposalCall::findOrFail($id);
        $path = $request->file('file')->store("proposal-calls/{$id}/guidelines", 'private');

        $call->update(['guidelines_file' => $path]);

        return response()->json([
            'data' => [
                'guidelines_file' => $path,
                'guidelines_filename' => $request->file('file')->getClientOriginalName(),
            ],
            'message' => 'Guidelines uploaded successfully.',
            'errors' => [],
        ]);
    }

    public function downloadGuidelines(string $id)
    {
        $call = ProposalCall::findOrFail($id);

        if (! $call->guidelines_file || ! Storage::disk('private')->exists($call->guidelines_file)) {
            abort(404, 'Guidelines file not found.');
        }

        return Storage::disk('private')->download(
            $call->guidelines_file,
            'guidelines-'.$call->slug.'.pdf'
        );
    }
}
