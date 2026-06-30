<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProposalResource;
use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\User;
use App\Models\WorkflowLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProposalController extends Controller
{
    /** Public, unauthenticated listing — only shows non-draft proposals. */
    public function publicIndex(Request $request): JsonResponse
    {
        $PUBLIC_STATUSES = ['submitted', 'validated', 'under_blind_review', 'accepted', 'funded', 'midterm_evaluation', 'completed', 'archived'];

        $query = Proposal::with(['pi:id,name', 'college:id,name', 'department:id,name'])
            ->whereNull('deleted_at');

        // Allow callers to restrict to specific status(es); default to all public statuses
        if ($request->filled('status')) {
            $requested = array_filter(explode(',', $request->status));
            $allowed = array_intersect($requested, $PUBLIC_STATUSES);
            $query->whereIn('status', empty($allowed) ? $PUBLIC_STATUSES : $allowed);
        } else {
            $query->whereIn('status', $PUBLIC_STATUSES);
        }

        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(fn ($sq) => $sq
                ->where('title', 'LIKE', "%{$q}%")
                ->orWhere('abstract', 'LIKE', "%{$q}%")
                ->orWhere('tracker_number', 'LIKE', "%{$q}%")
            );
        }
        if ($request->filled('pi_search')) {
            $query->whereHas('pi', fn ($q) => $q->where('name', 'LIKE', "%{$request->pi_search}%"));
        }
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('college_id')) {
            $query->where('college_id', $request->college_id);
        }
        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }
        if ($request->filled('sort') && $request->sort === 'oldest') {
            $query->orderBy('created_at');
        } else {
            $query->orderByDesc('created_at');
        }

        return response()->json(['data' => $query->paginate(20)]);
    }

    public function publicArchiveYears(): JsonResponse
    {
        $years = Proposal::whereIn('status', ['completed', 'archived'])
            ->whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->selectRaw('academic_year, COUNT(*) as count')
            ->groupBy('academic_year')
            ->orderByDesc('academic_year')
            ->get()
            ->map(fn ($r) => ['year' => $r->academic_year, 'count' => (int) $r->count]);

        return response()->json(['data' => $years]);
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $query = Proposal::with(['pi', 'college', 'proposalCall'])
            ->whereNull('deleted_at');

        if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
            // See all — apply optional filters
        } elseif ($user->hasAnyRole(['research_officer', 'community_officer', 'technology_officer'])) {
            // Category-scoped: middleware already sets _category_scope
        } elseif ($user->hasRole('college_officer')) {
            $query->where('college_id', $user->college_id);
        } elseif ($user->hasRole('staff')) {
            $query->where('pi_user_id', $user->id);
        }

        // Category scope injected by EnsureCategoryScope middleware
        if ($request->_category_scope) {
            $query->where('category', $request->_category_scope);
        } elseif ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('status')) {
            $statuses = array_filter(array_map('trim', explode(',', $request->status)));
            count($statuses) === 1
                ? $query->where('status', $statuses[0])
                : $query->whereIn('status', $statuses);
        }
        if ($request->filled('college_id')) {
            $query->where('college_id', $request->college_id);
        }
        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }
        if ($request->filled('search')) {
            $query->where('title', 'LIKE', '%'.$request->search.'%');
        }
        if ($request->filled('pi_search')) {
            $term = '%'.$request->pi_search.'%';
            $query->whereHas('pi', fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term));
        }
        if ($request->filled('member_search')) {
            $term = '%'.$request->member_search.'%';
            $query->where(fn ($q) => $q
                ->whereHas('pi', fn ($q2) => $q2->where('name', 'like', $term))
                ->orWhereHas('members', fn ($q2) => $q2
                    ->where('status', 'active')
                    ->whereHas('user', fn ($q3) => $q3->where('name', 'like', $term))
                )
            );
        }

        return response()->json(['data' => $query->orderByDesc('created_at')->paginate(20)]);
    }

    public function involved(Request $request): JsonResponse
    {
        $user = $request->user();
        $loads = ['proposalCall:id,title,academic_year', 'college:id,name', 'members', 'budgets', 'award:id,proposal_id,grant_reference,awarded_amount'];

        $map = fn ($p) => array_merge($p->toArray(), [
            'co_investigators_count' => $p->members->where('role', 'co_investigator')->where('status', 'active')->count(),
            'budget_total' => $p->budgets->sum('amount'),
            'award' => $p->award
                ? ['grant_reference' => $p->award->grant_reference, 'awarded_amount' => $p->award->awarded_amount]
                : null,
        ]);

        $asPI = Proposal::where('pi_user_id', $user->id)
            ->whereNull('deleted_at')
            ->with($loads)
            ->orderByDesc('updated_at')
            ->get()
            ->map($map);

        $asCoPi = Proposal::whereHas('members', fn ($q) => $q
            ->where('user_id', $user->id)
            ->where('role', 'co_investigator')
            ->where('status', 'active'))
            ->where('pi_user_id', '!=', $user->id)
            ->whereNull('deleted_at')
            ->with($loads)
            ->orderByDesc('updated_at')
            ->get()
            ->map(function ($p) use ($user, $map) {
                $membership = $p->members
                    ->where('user_id', $user->id)
                    ->where('role', 'co_investigator')
                    ->where('status', 'active')
                    ->first();

                return array_merge($map($p), [
                    'my_invitation_status' => $membership?->invitation_status ?? 'accepted',
                    'my_proposal_member_id' => $membership?->id,
                ]);
            });

        return response()->json([
            'data' => ['as_pi' => $asPI, 'as_co_pi' => $asCoPi],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function myProposals(Request $request): JsonResponse
    {
        $proposals = Proposal::where('pi_user_id', $request->user()->id)
            ->whereNull('deleted_at')
            ->with(['proposalCall:id,title,academic_year', 'college:id,name', 'members', 'budgets', 'award:id,proposal_id,grant_reference,awarded_amount'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($p) => array_merge($p->toArray(), [
                'co_investigators_count' => $p->members->where('role', 'co_investigator')->where('status', 'active')->count(),
                'budget_total' => $p->budgets->sum('amount'),
                'award' => $p->award ? [
                    'grant_reference' => $p->award->grant_reference,
                    'awarded_amount' => $p->award->awarded_amount,
                ] : null,
            ]));

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Use /proposals/draft to create a proposal.'], 422);
    }

    public function show(string $id): JsonResponse
    {
        $proposal = Proposal::with([
            'pi', 'college', 'proposalCall',
            'members.user.college', 'members.user.department', 'workflowLogs',
            'documents.uploadedBy:id,name', 'budgets',
            'award.approvedBy:id,name',
        ])->find($id);

        if (! $proposal) {
            return response()->json(['data' => null, 'message' => 'Proposal not found.', 'errors' => [], 'meta' => []], 404);
        }

        return response()->json(['data' => new ProposalResource($proposal)]);
    }

    public function budget(string $id): JsonResponse
    {
        $items = ProposalBudget::where('proposal_id', $id)->get();
        $total = $items->sum('amount');

        return response()->json([
            'data' => ['items' => $items, 'total' => $total],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function update(string $id): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Use the wizard step endpoints to update a proposal.'], 422);
    }

    public function destroy(string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user = request()->user();

        if ($proposal->pi_user_id !== $user->id) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        if ($proposal->status !== 'draft') {
            return response()->json(['data' => null, 'message' => 'Only draft proposals can be deleted.', 'errors' => []], 422);
        }

        $proposal->delete();

        return response()->json(['data' => null, 'message' => 'Proposal deleted.', 'errors' => []]);
    }

    public function statistics(Request $request): JsonResponse
    {
        $user = $request->user();

        // Full base — used for KPI totals (includes drafts so the draft card is accurate)
        $baseQuery = Proposal::query();

        if ($user->hasRole('college_officer')) {
            $baseQuery->where('proposals.college_id', $user->college_id);
        }

        $officerCategoryMap = [
            'research_officer' => 'research',
            'community_officer' => 'community_engagement',
            'technology_officer' => 'technology_transfer',
        ];
        foreach ($officerCategoryMap as $role => $category) {
            if ($user->hasRole($role)) {
                $baseQuery->where('proposals.category', $category);
                break;
            }
        }

        if ($request->_college_scope) {
            $baseQuery->where('proposals.college_id', $request->_college_scope);
        }

        if ($request->_category_scope) {
            $baseQuery->where('proposals.category', $request->_category_scope);
        }

        if ($request->academic_year) {
            $baseQuery->where('proposals.academic_year', $request->academic_year);
        }

        // Submitted-only base — used for all breakdown charts (excludes drafts)
        $submittedQuery = (clone $baseQuery)->whereNotIn('proposals.status', ['draft']);

        $byCollege = (clone $submittedQuery)
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->selectRaw('colleges.id, colleges.name as college_name, colleges.code,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN
                             ("funded","midterm_evaluation","completed","archived")
                             THEN 1 ELSE 0 END) as funded,
                         SUM(CASE WHEN proposals.status = "rejected"
                             THEN 1 ELSE 0 END) as rejected,
                         SUM(CASE WHEN proposals.status NOT IN
                             ("draft","rejected","archived")
                             THEN 1 ELSE 0 END) as active')
            ->groupBy('colleges.id', 'colleges.name', 'colleges.code')
            ->orderByDesc('total')
            ->get();

        $byDepartment = (clone $submittedQuery)
            ->join('departments', 'proposals.department_id', '=', 'departments.id')
            ->join('colleges', 'departments.college_id', '=', 'colleges.id')
            ->selectRaw('departments.id, departments.name as department_name,
                         departments.code, colleges.name as college_name,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN
                             ("funded","midterm_evaluation","completed","archived")
                             THEN 1 ELSE 0 END) as funded')
            ->groupBy('departments.id', 'departments.name',
                'departments.code', 'colleges.name')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $byGender = (clone $submittedQuery)
            ->join('users', 'proposals.pi_user_id', '=', 'users.id')
            ->selectRaw('COALESCE(users.gender, "not_specified") as gender,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN
                             ("funded","midterm_evaluation","completed","archived")
                             THEN 1 ELSE 0 END) as funded')
            ->groupBy('users.gender')
            ->get();

        $byStatus = (clone $submittedQuery)
            ->selectRaw('proposals.status as status, COUNT(*) as count')
            ->groupBy('proposals.status')
            ->pluck('count', 'status');

        $byCategory = (clone $submittedQuery)
            ->selectRaw('category, COUNT(*) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $totals = [
            'total' => (clone $baseQuery)->count(),
            'submitted' => (clone $baseQuery)->whereNotIn('proposals.status', ['draft'])->count(),
            'funded' => (clone $baseQuery)->whereIn('proposals.status', ['funded', 'midterm_evaluation', 'completed', 'archived'])->count(),
            'rejected' => (clone $baseQuery)->where('proposals.status', 'rejected')->count(),
            'under_review' => (clone $baseQuery)->whereIn('proposals.status', ['under_blind_review', 'under_open_defence', 'accepted'])->count(),
            'draft' => (clone $baseQuery)->where('proposals.status', 'draft')->count(),
        ];

        $currentAcademicYear = DB::table('app_settings')
            ->where('key', 'current_academic_year')
            ->value('value') ?? date('Y').'-'.(date('Y') + 1);

        $availableYears = Proposal::whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->distinct()
            ->orderByDesc('academic_year')
            ->pluck('academic_year');

        return response()->json([
            'data' => [
                'totals' => $totals,
                'by_college' => $byCollege,
                'by_department' => $byDepartment,
                'by_gender' => $byGender,
                'by_status' => $byStatus,
                'by_category' => $byCategory,
                'current_academic_year' => $currentAcademicYear,
                'available_years' => $availableYears,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function workflowHistory(string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user = request()->user();

        // College officers cannot see submission history — actor names reveal PI identity
        if ($user?->hasRole('college_officer')) {
            return response()->json(['data' => [], 'hidden' => true]);
        }

        $isAdmin = $user?->hasAnyRole(['super_admin', 'central_officer']);

        $history = WorkflowLog::where('proposal_id', $proposal->id)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($log) use ($isAdmin) {
                $actor = User::find($log->actor_id);
                $actorLabel = $actor?->name ?? 'System';

                if (! $isAdmin && $actor?->hasRole('staff')) {
                    $actorLabel = 'Reviewer';
                }

                return [
                    'from_stage' => $log->from_stage,
                    'action' => $log->action,
                    'to_stage' => $log->to_stage,
                    'actor' => $actorLabel,
                    'notes' => $log->notes,
                    'occurred_at' => $log->created_at,
                ];
            });

        return response()->json(['data' => $history]);
    }

    public function clone(Request $request, Proposal $proposal): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['data' => null, 'message' => 'Unauthenticated.', 'errors' => []], 401);
        }

        // Only the PI or admins can clone
        if ($proposal->pi_user_id !== $user->id && ! $user->hasAnyRole(['super_admin', 'admin', 'central_officer'])) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $year = date('Y');
        $suffix = strtoupper(Str::random(4));
        $trackerNumber = "RTT-{$year}-CLONE-{$suffix}";

        $clone = Proposal::create([
            'tracker_number' => $trackerNumber,
            'proposal_call_id' => $request->input('proposal_call_id', $proposal->proposal_call_id),
            'category' => $proposal->category,
            'title' => $proposal->title.' (Clone)',
            'abstract' => $proposal->abstract,
            'keywords' => $proposal->keywords,
            'status' => 'draft',
            'pi_user_id' => $user->id,
            'college_id' => $proposal->college_id,
            'department_id' => $proposal->department_id,
            'academic_year' => $request->input('academic_year', $proposal->academic_year),
            'focus_area' => $proposal->focus_area,
            'duration_months' => $proposal->duration_months,
            'research_type' => $proposal->research_type,
            'draft_data' => $proposal->draft_data,
            'current_wizard_step' => $proposal->current_wizard_step,
            'wizard_completed_steps' => $proposal->wizard_completed_steps,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'data' => $clone->only(['id', 'tracker_number', 'title', 'status']),
            'message' => 'Proposal cloned successfully.',
            'errors' => [],
        ], 201);
    }
}
