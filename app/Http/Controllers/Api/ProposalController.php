<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProposalResource;
use App\Models\Proposal;
use App\Models\User;
use App\Models\WorkflowLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProposalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user  = $request->user();
        $query = Proposal::with(['pi', 'college', 'proposalCall'])
            ->whereNull('deleted_at');

        if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
            // See all — apply optional filters
        } elseif ($user->hasAnyRole(['research_officer', 'community_officer', 'technology_officer'])) {
            // Category-scoped: middleware already sets _category_scope
        } elseif ($user->hasRole('college_officer')) {
            $query->where('college_id', $user->college_id);
        } elseif ($user->hasRole('college_officer')) {
            $query->where('college_id', $user->college_id);
        } elseif ($user->hasRole('staff')) {
            $query->where('pi_user_id', $user->id);
        } elseif ($user->hasRole('college_officer')) {
            $query->where('department_id', $user->department_id);
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

        return response()->json(['data' => $query->orderByDesc('created_at')->paginate(20)]);
    }

    public function involved(Request $request): JsonResponse
    {
        $user  = $request->user();
        $loads = ['proposalCall:id,title,academic_year', 'college:id,name', 'members', 'budgets', 'award:id,proposal_id,grant_reference,awarded_amount'];

        $map = fn ($p) => array_merge($p->toArray(), [
            'co_investigators_count' => $p->members->where('role', 'co_investigator')->where('status', 'active')->count(),
            'budget_total'           => $p->budgets->sum('amount'),
            'award'                  => $p->award
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
            ->map($map);

        return response()->json([
            'data'    => ['as_pi' => $asPI, 'as_co_pi' => $asCoPi],
            'message' => '',
            'errors'  => [],
            'meta'    => [],
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
                'budget_total'           => $p->budgets->sum('amount'),
                'award'                  => $p->award ? [
                    'grant_reference' => $p->award->grant_reference,
                    'awarded_amount'  => $p->award->awarded_amount,
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
            'members.user', 'workflowLogs',
            'documents.uploadedBy:id,name', 'budgets',
            'award.approvedBy:id,name',
        ])->findOrFail($id);

        return response()->json(['data' => new ProposalResource($proposal)]);
    }

    public function budget(string $id): JsonResponse
    {
        $items = \App\Models\ProposalBudget::where('proposal_id', $id)->get();
        $total = $items->sum('amount');

        return response()->json([
            'data'    => ['items' => $items, 'total' => $total],
            'message' => '',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    public function update(string $id): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Use the wizard step endpoints to update a proposal.'], 422);
    }

    public function destroy(string $id): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Not implemented.'], 422);
    }

    public function statistics(Request $request): JsonResponse
    {
        $user = $request->user();

        $baseQuery = \App\Models\Proposal::whereNull('deleted_at');

        if ($user->hasRole('college_officer') || $user->hasRole('college_officer')) {
            $baseQuery->where('college_id', $user->college_id);
        }

        if ($request->_category_scope) {
            $baseQuery->where('category', $request->_category_scope);
        }

        if ($request->academic_year) {
            $baseQuery->where('academic_year', $request->academic_year);
        }

        $byCollege = (clone $baseQuery)
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

        $byDepartment = (clone $baseQuery)
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

        $byGender = (clone $baseQuery)
            ->join('users', 'proposals.pi_user_id', '=', 'users.id')
            ->selectRaw('COALESCE(users.gender, "not_specified") as gender,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN
                             ("funded","midterm_evaluation","completed","archived")
                             THEN 1 ELSE 0 END) as funded')
            ->groupBy('users.gender')
            ->get();

        $byStatus = (clone $baseQuery)
            ->selectRaw('status, COUNT(*) as count')
            ->whereNotIn('status', ['draft'])
            ->groupBy('status')
            ->pluck('count', 'status');

        $byCategory = (clone $baseQuery)
            ->selectRaw('category, COUNT(*) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $totals = [
            'total'        => (clone $baseQuery)->count(),
            'submitted'    => (clone $baseQuery)->whereNotIn('status', ['draft'])->count(),
            'funded'       => (clone $baseQuery)->whereIn('status', ['funded', 'midterm_evaluation', 'completed', 'archived'])->count(),
            'rejected'     => (clone $baseQuery)->where('status', 'rejected')->count(),
            'under_review' => (clone $baseQuery)->whereIn('status', ['under_blind_review', 'under_open_defence', 'accepted'])->count(),
        ];

        return response()->json([
            'data' => [
                'totals'        => $totals,
                'by_college'    => $byCollege,
                'by_department' => $byDepartment,
                'by_gender'     => $byGender,
                'by_status'     => $byStatus,
                'by_category'   => $byCategory,
            ],
            'message' => '',
            'errors'  => [],
            'meta'    => [],
        ]);
    }

    public function workflowHistory(string $id): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user     = request()->user();

        $isAdmin = $user?->hasAnyRole(['super_admin', 'central_officer', 'college_officer']);

        $history = WorkflowLog::where('proposal_id', $proposal->id)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($log) use ($isAdmin) {
                $actor      = \App\Models\User::find($log->actor_id);
                $actorLabel = $actor?->name ?? 'System';

                if (! $isAdmin && $actor?->hasRole('staff')) {
                    $actorLabel = 'Reviewer';
                }

                return [
                    'from_stage'  => $log->from_stage,
                    'action'      => $log->action,
                    'to_stage'    => $log->to_stage,
                    'actor'       => $actorLabel,
                    'notes'       => $log->notes,
                    'occurred_at' => $log->created_at,
                ];
            });

        return response()->json(['data' => $history]);
    }
}
