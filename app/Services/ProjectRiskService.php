<?php

namespace App\Services;

use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\ThresholdSetting;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Funded projects that need attention: each running project's time, money and
 * progress are compared and turned into plain signals (ended but not completed,
 * no money released, behind schedule, reports overdue…). A project is "high" risk
 * when any signal is serious or three or more add up, "watch" with any signal,
 * otherwise on track. Nothing is stored; it is worked out from current records.
 */
class ProjectRiskService
{
    /** Funded projects still running; completed ones are only waiting to be archived. */
    public const RUNNING_STATUSES = ['funded', 'midterm_evaluation'];

    public const LEVEL_LABELS = ['high' => 'High risk', 'watch' => 'Watch', 'on_track' => 'On track'];

    /** Short names of the warnings, for summaries and exports. */
    public const SIGNAL_LABELS = [
        'past_end' => 'Past end date',
        'no_funds' => 'No money released',
        'behind_schedule' => 'Behind schedule',
        'reports_overdue' => 'Reports overdue',
        'overspending' => 'Spending ahead of progress',
        'slow_spending' => 'Little money used late',
        'midterm_overdue' => 'Midterm overdue',
        'no_contract' => 'No approved contract',
        'no_start' => 'No funding date',
    ];

    /** Days after funding with no money released before it counts. */
    private const NO_FUNDS_AFTER_DAYS = 60;

    /** Share of the project time after which no money released is serious. */
    private const NO_FUNDS_SERIOUS_PCT = 25;

    /** Points the reported progress may trail the time used before it counts, and before it is serious. */
    private const BEHIND_PTS = 25;

    private const BEHIND_SERIOUS_PTS = 40;

    /** Points reported spending may run ahead of reported progress. */
    private const OVERSPEND_PTS = 30;

    /** Late in the project (time used %) with less than half the money released. */
    private const SLOW_SPEND_TIME_PCT = 75;

    private const SLOW_SPEND_RELEASED_PCT = 50;

    /** Days without an approved contract after funding. */
    private const CONTRACT_AFTER_DAYS = 30;

    /** Days a report may be overdue before a single one is serious. */
    private const REPORT_SERIOUS_DAYS = 30;

    /**
     * Every running project in the query, assessed, most at risk first.
     *
     * @param  Builder<Proposal>  $query
     * @return Collection<int, array<string, mixed>>
     */
    public function assess(Builder $query): Collection
    {
        $midtermDays = (int) (ThresholdSetting::where('key', 'ongoing_midterm_overdue_days')->value('value') ?? 90);

        return $query
            ->whereIn('proposals.status', self::RUNNING_STATUSES)
            ->with([
                'award:id,proposal_id,approved_at,awarded_amount',
                'pi:id,name,title',
                'college:id,name',
                'progressReports',
                'midtermEvaluations:id,proposal_id',
                'budgetAllocations:id,proposal_id,total_amount',
                'budgetRequests:id,proposal_id',
                'budgetRequests.disbursements:id,budget_request_id,amount',
            ])
            ->get()
            ->map(fn (Proposal $proposal) => $this->assessOne($proposal, $midtermDays))
            ->sortBy([['rank', 'desc'], ['signal_count', 'desc'], ['elapsed_pct', 'desc']])
            ->values();
    }

    /** @return array<string, mixed> */
    private function assessOne(Proposal $proposal, int $midtermDays): array
    {
        $today = now()->startOfDay();
        $start = $proposal->award?->approved_at?->copy()->startOfDay();
        $months = max(1, (int) ($proposal->duration_months ?: 12));
        $end = $start?->copy()->addMonths($months);
        $daysSinceStart = $start ? (int) $start->diffInDays($today) : null;
        $elapsedPct = ($start && $end) ? $this->pct($start->diffInDays($today), $start->diffInDays($end)) : null;

        $budget = (float) ($proposal->award?->awarded_amount ?: $proposal->budgetAllocations->sum('total_amount'));
        $released = (float) $proposal->budgetRequests->flatMap->disbursements->sum('amount');
        $releasedPct = $budget > 0 ? $this->pct($released, $budget) : null;

        $reports = $proposal->progressReports;
        $latest = $reports
            ->whereIn('status', [ProgressReport::STATUS_SUBMITTED, ProgressReport::STATUS_ACCEPTED])
            ->sortByDesc('period_number')
            ->first();
        $progress = $latest?->percent_complete;
        $spentPct = ($latest && $latest->budget_spent !== null && $budget > 0) ? $this->pct((float) $latest->budget_spent, $budget) : null;
        $overdue = $reports->filter(fn (ProgressReport $r) => $r->isOverdue());
        $oldestOverdueDays = $overdue->isEmpty() ? 0 : (int) $overdue->min('due_date')->diffInDays($today);

        $signals = [];
        $add = function (string $key, string $level, string $label, string $detail) use (&$signals) {
            $signals[] = compact('key', 'level', 'label', 'detail');
        };

        if (! $start) {
            $add('no_start', 'watch', 'No funding date', 'There is no approved award on record, so time and money cannot be checked.');
        }

        if ($end && $today->greaterThan($end)) {
            $add('past_end', 'high', 'Past its end date', 'Planned to end on '.$end->format('j M Y').' ('.(int) $end->diffInDays($today).' days ago) but is not completed.');
        }

        if ($start && $released <= 0 && $daysSinceStart >= self::NO_FUNDS_AFTER_DAYS) {
            $add('no_funds', $elapsedPct >= self::NO_FUNDS_SERIOUS_PCT ? 'high' : 'watch', 'No money released',
                "Funded {$daysSinceStart} days ago and nothing has been disbursed yet.");
        }

        if ($progress !== null && $elapsedPct !== null && $elapsedPct - $progress >= self::BEHIND_PTS) {
            $add('behind_schedule', $elapsedPct - $progress >= self::BEHIND_SERIOUS_PTS ? 'high' : 'watch', 'Behind schedule',
                "{$progress}% complete with {$elapsedPct}% of the project time used.");
        }

        if ($overdue->isNotEmpty()) {
            $count = $overdue->count();
            $add('reports_overdue', ($count >= 2 || $oldestOverdueDays > self::REPORT_SERIOUS_DAYS) ? 'high' : 'watch',
                $count === 1 ? 'Progress report overdue' : "{$count} progress reports overdue",
                "The oldest has been due for {$oldestOverdueDays} day".($oldestOverdueDays === 1 ? '' : 's').'.');
        }

        if ($spentPct !== null && $progress !== null && $spentPct - $progress >= self::OVERSPEND_PTS) {
            $add('overspending', 'watch', 'Spending ahead of progress',
                "Reports {$spentPct}% of the budget spent but only {$progress}% of the work done.");
        }

        if ($elapsedPct !== null && $releasedPct !== null && $released > 0
            && $elapsedPct >= self::SLOW_SPEND_TIME_PCT && $releasedPct < self::SLOW_SPEND_RELEASED_PCT) {
            $add('slow_spending', 'watch', 'Little money used late in the project',
                "{$releasedPct}% of the budget released with {$elapsedPct}% of the time used.");
        }

        if ($proposal->status === 'funded' && $proposal->midtermEvaluations->isEmpty() && $start && $daysSinceStart > $midtermDays) {
            $add('midterm_overdue', 'watch', 'Midterm evaluation overdue',
                "Funded {$daysSinceStart} days ago and no midterm evaluation is scheduled.");
        }

        if ($start && $proposal->contract_status !== 'approved' && $daysSinceStart > self::CONTRACT_AFTER_DAYS) {
            $add('no_contract', 'watch', 'No approved contract',
                "Funded {$daysSinceStart} days ago and the contract is not approved yet.");
        }

        $hasHigh = collect($signals)->contains('level', 'high');
        $level = ($hasHigh || count($signals) >= 3) ? 'high' : (count($signals) > 0 ? 'watch' : 'on_track');

        return [
            'id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'category' => $proposal->category,
            'status' => $proposal->status,
            'pi' => $proposal->pi ? trim(($proposal->pi->title ? $proposal->pi->title.' ' : '').$proposal->pi->name) : null,
            'college' => $proposal->college?->name,
            'start_date' => $start?->toDateString(),
            'end_date' => $end?->toDateString(),
            'duration_months' => $months,
            'elapsed_pct' => $elapsedPct,
            'days_left' => $end ? (int) $today->diffInDays($end, false) : null,
            'budget' => $budget,
            'released' => $released,
            'released_pct' => $releasedPct,
            'reported_progress' => $progress,
            'reported_spent_pct' => $spentPct,
            'last_report_at' => $latest?->submitted_at?->toIso8601String(),
            'overdue_reports' => $overdue->count(),
            'level' => $level,
            'rank' => ['on_track' => 0, 'watch' => 1, 'high' => 2][$level],
            'signal_count' => count($signals),
            'signals' => $signals,
        ];
    }

    /**
     * Headline counts for a set of assessed projects.
     *
     * @param  Collection<int, array<string, mixed>>  $projects
     * @return array{total: int, high: int, watch: int, on_track: int, by_signal: array<string, int>}
     */
    public function summary(Collection $projects): array
    {
        return [
            'total' => $projects->count(),
            'high' => $projects->where('level', 'high')->count(),
            'watch' => $projects->where('level', 'watch')->count(),
            'on_track' => $projects->where('level', 'on_track')->count(),
            'by_signal' => $projects->flatMap(fn ($p) => collect($p['signals'])->pluck('key'))->countBy()->all(),
        ];
    }

    /**
     * Narrow assessed projects to a level, a warning and/or a search term (title,
     * tracker number, PI or college), as the page filters them.
     *
     * @param  Collection<int, array<string, mixed>>  $projects
     * @return Collection<int, array<string, mixed>>
     */
    public function filter(Collection $projects, ?string $level, ?string $signal, ?string $search): Collection
    {
        $term = mb_strtolower(trim((string) $search));

        return $projects
            ->when($level, fn ($c) => $c->where('level', $level))
            ->when($signal, fn ($c) => $c->filter(fn ($p) => collect($p['signals'])->contains('key', $signal)))
            ->when($term !== '', fn ($c) => $c->filter(fn ($p) => collect([$p['title'], $p['tracker_number'], $p['pi'], $p['college']])
                ->contains(fn ($v) => str_contains(mb_strtolower((string) $v), $term))))
            ->values();
    }

    private function pct(float $part, float $whole): int
    {
        return $whole > 0 ? (int) round(min(100, max(0, $part / $whole * 100))) : 0;
    }
}
