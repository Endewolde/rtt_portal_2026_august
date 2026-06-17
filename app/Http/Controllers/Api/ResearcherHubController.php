<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Award;
use App\Models\BudgetSettlement;
use App\Models\Disbursement;
use App\Models\ExternalFundOpportunity;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ResearchOutput;
use App\Models\ReviewAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ResearcherHubController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'proposals' => $this->proposals($user),
                'reviewAssignments' => $this->reviewAssignments($user),
                'upcomingDeadlines' => $this->upcomingDeadlines(),
                'researchOutputs' => $this->researchOutputCounts($user),
                'budgetSummary' => $this->budgetSummary($user),
            ],
        ]);
    }

    /** @return array<int, mixed> */
    private function proposals(object $user): array
    {
        $asPI = Proposal::with([
            'proposalCall:id,title,category',
            'award:id,proposal_id,awarded_amount',
            'college:id,name',
        ])
            ->where('pi_user_id', $user->id)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->get(['id', 'tracker_number', 'title', 'status', 'category', 'proposal_call_id', 'college_id', 'submitted_at', 'created_at'])
            ->map(fn ($p) => array_merge($p->toArray(), ['role' => 'pi']))
            ->toArray();

        $asMember = Proposal::with([
            'proposalCall:id,title,category',
            'award:id,proposal_id,awarded_amount',
            'college:id,name',
        ])
            ->whereHas('activeMembers', fn ($q) => $q->where('user_id', $user->id))
            ->where('pi_user_id', '!=', $user->id)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->get(['id', 'tracker_number', 'title', 'status', 'category', 'proposal_call_id', 'college_id', 'submitted_at', 'created_at'])
            ->map(fn ($p) => array_merge($p->toArray(), ['role' => 'co_investigator']))
            ->toArray();

        return array_merge($asPI, $asMember);
    }

    /** @return array<int, mixed> */
    private function reviewAssignments(object $user): array
    {
        return ReviewAssignment::with([
            'proposal:id,tracker_number,title,category',
            'evaluationType:id,name,label',
        ])
            ->where('reviewer_id', $user->id)
            ->whereIn('status', ['pending', 'in_progress'])
            ->orderBy('due_date')
            ->get(['id', 'proposal_id', 'evaluation_type_id', 'status', 'assigned_at', 'due_date'])
            ->toArray();
    }

    /** @return array<int, array{id: string, title: string, type: string, date: string}> */
    private function upcomingDeadlines(): array
    {
        $calls = ProposalCall::active()
            ->where('end_date', '>=', now())
            ->orderBy('end_date')
            ->limit(10)
            ->get(['id', 'title', 'end_date', 'category'])
            ->map(fn ($c) => [
                'id' => $c->id,
                'title' => $c->title,
                'type' => 'proposal_call',
                'date' => $c->end_date->toDateTimeString(),
            ]);

        $funds = ExternalFundOpportunity::where('status', 'open')
            ->where('deadline', '>=', now())
            ->orderBy('deadline')
            ->limit(10)
            ->get(['id', 'title', 'deadline', 'category'])
            ->map(fn ($f) => [
                'id' => $f->id,
                'title' => $f->title,
                'type' => 'external_fund',
                'date' => $f->deadline->toDateTimeString(),
            ]);

        return $calls->concat($funds)
            ->sortBy('date')
            ->take(10)
            ->values()
            ->toArray();
    }

    /** @return array<string, int> */
    private function researchOutputCounts(object $user): array
    {
        $counts = ResearchOutput::where('recorded_by', $user->id)
            ->select('output_type', DB::raw('count(*) as total'))
            ->groupBy('output_type')
            ->pluck('total', 'output_type')
            ->toArray();

        $types = ['journal_article', 'conference_paper', 'book', 'patent', 'software', 'prototype', 'community_impact', 'technology_transfer'];

        return array_merge(array_fill_keys($types, 0), $counts);
    }

    /** @return array{awarded: string, disbursed: string, settled: string} */
    private function budgetSummary(object $user): array
    {
        $proposalIds = Proposal::where('pi_user_id', $user->id)
            ->whereNull('deleted_at')
            ->pluck('id');

        $awarded = Award::whereIn('proposal_id', $proposalIds)->sum('awarded_amount');

        $disbursed = Disbursement::whereHas(
            'budgetRequest',
            fn ($q) => $q->whereIn('proposal_id', $proposalIds)
        )->sum('amount');

        $settled = BudgetSettlement::whereHas(
            'budgetRequest',
            fn ($q) => $q->whereIn('proposal_id', $proposalIds)
        )->sum('total_spent');

        return [
            'awarded' => number_format((float) $awarded, 2),
            'disbursed' => number_format((float) $disbursed, 2),
            'settled' => number_format((float) $settled, 2),
        ];
    }
}
