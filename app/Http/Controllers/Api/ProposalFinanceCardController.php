<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\ProgressReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Everything the budget pages show when you hover a project: who and where it is,
 * its award and allocation, each funding round from request to settlement, and
 * where its milestones and midterm evaluation stand — in one small request.
 */
class ProposalFinanceCardController extends Controller
{
    private const FINANCE_PERMISSIONS = [
        'proposals.view_any', 'budget_allocations.view_any', 'budget_requests.view_any',
        'disbursements.view_any', 'settlements.view_any', 'budget_milestones.view_any', 'funding.manage',
    ];

    public function __invoke(Request $request, string $id, ProgressReportService $team): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::with([
            'pi:id,name,email,phone',
            'college:id,name',
            'department:id,name',
            'proposalCall:id,title',
            'award:id,proposal_id,awarded_amount,grant_reference,approved_at',
            'activeMembers.user:id,name',
            'budgetAllocations' => fn ($q) => $q->where('allocation_type', 'proposal')->latest(),
            'budgetRequests' => fn ($q) => $q->with(['disbursements:id,budget_request_id,amount,disbursed_at', 'settlement'])->orderBy('funding_round'),
            'budgetMilestones:id,proposal_id,title,status,due_date,completed_at,amount',
            'midtermEvaluations' => fn ($q) => $q->latest('evaluation_date'),
        ])->findOrFail($id);

        $isTeam = $team->isTeamMember($proposal, $user);
        $inScope = $user->accessScope()->covers($proposal->college_id, $proposal->category)
            && collect(self::FINANCE_PERMISSIONS)->contains(fn ($p) => $user->can($p));
        if (! $isTeam && ! $inScope) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }
        $showPeople = $isTeam || $user->can('proposals.view_identity');

        $requests = $proposal->budgetRequests;
        $live = $requests->whereNotIn('status', ['rejected']);
        $disbursed = (float) $requests->sum(fn ($r) => $r->disbursements->sum('amount'));
        $settled = $requests->filter(fn ($r) => $r->settlement?->status === 'finance_verified');
        $awarded = (float) ($proposal->award?->awarded_amount ?? 0);
        $allocation = $proposal->budgetAllocations->first();
        $milestones = $proposal->budgetMilestones;
        $openMilestones = $milestones->filter(fn ($m) => $m->status !== 'completed' && ! $m->completed_at);
        $midterm = $proposal->midtermEvaluations->first();

        return response()->json([
            'data' => [
                'id' => $proposal->id,
                'tracker_number' => $proposal->tracker_number,
                'title' => $proposal->title,
                'status' => $proposal->status,
                'category' => $proposal->category,
                'academic_year' => $proposal->academic_year,
                'duration_months' => $proposal->duration_months,
                'call' => $proposal->proposalCall?->title,
                'college' => $proposal->college?->name,
                'department' => $proposal->department?->name,
                'pi' => $showPeople && $proposal->pi ? ['name' => $proposal->pi->name, 'email' => $proposal->pi->email, 'phone' => $proposal->pi->phone] : null,
                'team' => $showPeople ? $proposal->activeMembers->map(fn ($m) => ['name' => $m->user?->name, 'role' => $m->role])->filter(fn ($m) => $m['name'])->values() : [],
                'award' => $proposal->award ? [
                    'amount' => $awarded,
                    'grant_reference' => $proposal->award->grant_reference,
                    'approved_at' => $proposal->award->approved_at?->toDateString(),
                ] : null,
                'allocation' => $allocation ? [
                    'status' => $allocation->status,
                    'amount' => (float) $allocation->total_amount,
                    'fiscal_year' => $allocation->fiscal_year,
                ] : null,
                'money' => [
                    'awarded' => $awarded,
                    'requested' => (float) $live->sum('total_amount'),
                    'approved' => (float) $requests->whereIn('status', ['approved', 'disbursed', 'settled'])->sum('total_amount'),
                    'disbursed' => $disbursed,
                    'spent' => (float) $settled->sum(fn ($r) => $r->settlement->total_spent),
                    'unspent' => (float) $settled->sum(fn ($r) => $r->settlement->unspent_amount),
                    'remaining' => max(0, $awarded - $disbursed),
                ],
                'rounds' => $requests->map(fn ($r) => [
                    'round' => $r->funding_round,
                    'status' => $r->status,
                    'amount' => (float) $r->total_amount,
                    'disbursed' => (float) $r->disbursements->sum('amount'),
                    'settlement' => $r->settlement?->status,
                ])->values(),
                'milestones' => [
                    'total' => $milestones->count(),
                    'done' => $milestones->count() - $openMilestones->count(),
                    'overdue' => $openMilestones->filter(fn ($m) => $m->due_date && $m->due_date->isPast())->count(),
                    'next' => $openMilestones->filter(fn ($m) => $m->due_date)->sortBy('due_date')->map(fn ($m) => ['title' => $m->title, 'due_date' => $m->due_date->toDateString()])->first(),
                ],
                'midterm' => $midterm ? ['status' => $midterm->status, 'recommendation' => $midterm->recommendation] : null,
            ],
            'message' => '',
            'errors' => [],
        ]);
    }
}
