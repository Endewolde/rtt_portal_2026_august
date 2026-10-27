<?php

namespace App\Services;

use App\Models\CallCollegeBudget;
use App\Models\Proposal;
use App\Models\ProposalCall;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * A call's funding budget: what has been committed in awards, what is left, and the
 * merit list — proposals awaiting the central decision ranked by combined score, with
 * where the remaining money runs out.
 */
class FundingBudgetService
{
    public function __construct(private ReviewScoreService $scores) {}

    /** @return array{budget: float|null, committed: float, remaining: float|null, awards: int} */
    public function summary(ProposalCall $call, ?string $excludingProposalId = null): array
    {
        $committed = DB::table('awards as a')
            ->join('proposals as p', 'p.id', '=', 'a.proposal_id')
            ->where('p.proposal_call_id', $call->id)
            ->whereNull('p.deleted_at')
            ->whereIn('p.status', AnalyticsService::FUNDED)
            ->when($excludingProposalId, fn ($q, $id) => $q->where('p.id', '!=', $id))
            ->selectRaw('COALESCE(SUM(a.awarded_amount), 0) as total, COUNT(*) as awards')
            ->first();

        $budget = $call->funding_budget !== null ? (float) $call->funding_budget : null;

        return [
            'budget' => $budget,
            'committed' => round((float) $committed->total, 2),
            'remaining' => $budget !== null ? round($budget - (float) $committed->total, 2) : null,
            'awards' => (int) $committed->awards,
        ];
    }

    /**
     * One college's share of the call: what the central office allocated to it, what its
     * proposals in the call were awarded, and what is left. Budget is null with no share set.
     *
     * @return array{budget: float|null, committed: float, remaining: float|null, awards: int}
     */
    public function collegeSummary(ProposalCall $call, string $collegeId, ?string $excludingProposalId = null): array
    {
        $committed = $this->committedQuery($call, $excludingProposalId)->where('p.college_id', $collegeId)->first();
        $allocation = CallCollegeBudget::where('proposal_call_id', $call->id)->where('college_id', $collegeId)->value('amount');
        $budget = $allocation !== null ? (float) $allocation : null;

        return [
            'budget' => $budget,
            'committed' => round((float) $committed->total, 2),
            'remaining' => $budget !== null ? round($budget - (float) $committed->total, 2) : null,
            'awards' => (int) $committed->awards,
        ];
    }

    /** What each college's proposals in the call were awarded, keyed by college id. */
    public function committedByCollege(ProposalCall $call): array
    {
        return $this->committedQuery($call)->groupBy('p.college_id')
            ->selectRaw('p.college_id')
            ->pluck('total', 'college_id')
            ->map(fn ($v) => round((float) $v, 2))
            ->all();
    }

    private function committedQuery(ProposalCall $call, ?string $excludingProposalId = null): Builder
    {
        return DB::table('awards as a')
            ->join('proposals as p', 'p.id', '=', 'a.proposal_id')
            ->where('p.proposal_call_id', $call->id)
            ->whereNull('p.deleted_at')
            ->whereIn('p.status', AnalyticsService::FUNDED)
            ->when($excludingProposalId, fn ($q, $id) => $q->where('p.id', '!=', $id))
            ->selectRaw('COALESCE(SUM(a.awarded_amount), 0) as total, COUNT(*) as awards');
    }

    /**
     * Proposals of the call awaiting the central decision, best first, with a running total
     * of requested budgets against what remains.
     *
     * @return array<string, mixed>
     */
    public function meritList(ProposalCall $call, ?array $scope = null): array
    {
        $summary = $this->summary($call);

        $proposals = Proposal::with(['pi:id,name', 'college:id,name', 'budgets'])
            ->where('proposal_call_id', $call->id)
            ->where('status', 'accepted')
            ->when($scope['college_id'] ?? null, fn ($q, $id) => $q->where('college_id', $id))
            ->when($scope['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->get()
            ->map(function (Proposal $p) {
                $snapshot = $this->scores->recalculateSnapshot($p);

                return [
                    'id' => $p->id,
                    'tracker_number' => $p->tracker_number,
                    'title' => $p->title,
                    'pi' => $p->pi?->name,
                    'college' => $p->college?->name,
                    'combined_score' => $snapshot['combined'],
                    'combined_max' => $snapshot['combined_max'],
                    'threshold' => $snapshot['combined_threshold'],
                    'requested' => round((float) $p->budgets->sum('amount'), 2),
                ];
            })
            ->sortByDesc('combined_score')
            ->values();

        $running = 0.0;
        $ranked = $proposals->map(function ($row, $i) use (&$running, $summary) {
            $running += $row['requested'];

            return $row + [
                'rank' => $i + 1,
                'cumulative' => round($running, 2),
                // Without a budget every proposal "fits"; with one, it fits while the running total stays within what's left.
                'fits' => $summary['remaining'] === null || $running <= $summary['remaining'] + 0.005,
            ];
        });

        return [
            'call' => ['id' => $call->id, 'title' => $call->title, 'academic_year' => $call->academic_year] + $summary,
            'proposals' => $ranked->all(),
            'fitting' => $ranked->where('fits', true)->count(),
            'requested_total' => round($proposals->sum('requested'), 2),
        ];
    }
}
