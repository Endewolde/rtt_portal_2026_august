<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Analytics dashboard figures, with one set of definitions used everywhere:
 *
 * - Submitted: every proposal except drafts.
 * - Funded: funded, at mid-term, completed or archived — not proposals still awaiting
 *   the central decision.
 * - Decided: funded + rejected. Pass rate = funded ÷ decided, so proposals still in
 *   review don't count as failures.
 */
class AnalyticsService
{
    public const FUNDED = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    public const REJECTED = ['rejected'];

    /** Pipeline milestones in order, and the statuses that mean a proposal has reached at least that far. */
    private const MILESTONES = [
        ['key' => 'submitted', 'label' => 'Submitted'],
        ['key' => 'validated', 'label' => 'Validated'],
        ['key' => 'blind_passed', 'label' => 'Passed Blind Review'],
        ['key' => 'defence_passed', 'label' => 'Passed Open Defence'],
        ['key' => 'funded', 'label' => 'Funded'],
    ];

    /** How far each status has got along the milestones (index into MILESTONES). */
    private const STATUS_REACH = [
        'submitted' => 0,
        'validated' => 1, 'under_blind_review' => 1,
        'blind_review_passed' => 2, 'under_open_defence' => 2,
        'accepted' => 3,
        'funded' => 4, 'midterm_evaluation' => 4, 'completed' => 4, 'archived' => 4,
    ];

    /** Where proposals are right now, for the "current pipeline" view. */
    private const CURRENT_STAGES = [
        'validation' => ['label' => 'Awaiting validation', 'statuses' => ['submitted']],
        'blind_review' => ['label' => 'Blind review', 'statuses' => ['validated', 'under_blind_review']],
        'open_defence' => ['label' => 'Open defence', 'statuses' => ['blind_review_passed', 'under_open_defence']],
        'central' => ['label' => 'Central evaluation', 'statuses' => ['accepted']],
        'funded' => ['label' => 'Funded', 'statuses' => self::FUNDED],
        'rejected' => ['label' => 'Not selected', 'statuses' => self::REJECTED],
    ];

    /** Minimum completed academic years, and fit, before a forecast is shown. */
    private const FORECAST_MIN_YEARS = 3;

    private const FORECAST_MIN_R2 = 0.5;

    /** Themes listed individually before the rest are grouped. */
    private const MAX_THEMES = 12;

    public function __construct(private TurnaroundService $turnaround) {}

    /**
     * @param  array{academic_year: string|null, college_id: string|null, category: string|null, proposal_call_id?: string|null}  $filters  null = all
     * @return array<string, mixed>
     */
    public function dashboard(array $filters): array
    {
        return [
            'summary' => $this->summary($filters),
            'funnel' => $this->funnel($filters),
            'pipeline' => $this->pipeline($filters),
            'categories' => $this->byCategory($filters),
            'colleges' => $this->byCollege($filters),
            'themes' => $this->byTheme($filters),
            'years' => $this->byYear($filters),
            'monthly' => $this->monthlySubmissions($filters),
            'researchTypes' => $this->byResearchType($filters),
            'gender' => $this->byGender($filters),
            'money' => $this->money($filters),
            'review' => $this->review($filters),
            'forecast' => $this->forecast($filters),
        ];
    }

    /** @return array<string, mixed> */
    private function summary(array $filters): array
    {
        $row = $this->proposals($filters)->selectRaw($this->outcomeColumns())->first();

        return $this->withRate([
            'submitted' => (int) $row->submitted,
            'funded' => (int) $row->funded,
            'rejected' => (int) $row->rejected,
            'in_progress' => (int) $row->in_progress,
        ]);
    }

    /**
     * How many proposals reached each milestone. A rejected proposal counts as having
     * reached the stage it was rejected at.
     *
     * @return list<array{key: string, label: string, count: int, pct_of_submitted: float|null}>
     */
    private function funnel(array $filters): array
    {
        $reached = $this->reached($this->proposals($filters)->get(['p.id', 'p.status']));
        $submitted = $reached[0];

        return collect(self::MILESTONES)->map(fn ($m, $i) => [
            'key' => $m['key'],
            'label' => $m['label'],
            'count' => $reached[$i],
            'pct_of_submitted' => $submitted > 0 ? round($reached[$i] / $submitted * 100, 1) : null,
        ])->all();
    }

    /**
     * How many of these proposals reached each milestone (index into MILESTONES).
     *
     * @param  Collection<int, object{id: string, status: string}>  $proposals
     * @return list<int>
     */
    private function reached(Collection $proposals): array
    {
        $rejectedFrom = DB::table('workflow_logs')
            ->whereIn('proposal_id', $proposals->where('status', 'rejected')->pluck('id'))
            ->where('to_stage', 'rejected')
            ->orderBy('created_at')
            ->pluck('from_stage', 'proposal_id');

        $reached = array_fill(0, count(self::MILESTONES), 0);
        foreach ($proposals as $proposal) {
            $reach = $proposal->status === 'rejected'
                ? (self::STATUS_REACH[$rejectedFrom[$proposal->id] ?? 'submitted'] ?? 0)
                : (self::STATUS_REACH[$proposal->status] ?? 0);
            for ($i = 0; $i <= $reach; $i++) {
                $reached[$i]++;
            }
        }

        return $reached;
    }

    /** @return list<array{key: string, label: string, count: int}> */
    private function pipeline(array $filters): array
    {
        $counts = $this->proposals($filters)->select('p.status', DB::raw('COUNT(*) as c'))->groupBy('p.status')->pluck('c', 'status');

        return collect(self::CURRENT_STAGES)->map(fn ($stage, $key) => [
            'key' => $key,
            'label' => $stage['label'],
            'count' => (int) collect($stage['statuses'])->sum(fn ($s) => $counts[$s] ?? 0),
        ])->values()->all();
    }

    /** @return list<array<string, mixed>> */
    private function byCategory(array $filters): array
    {
        return $this->proposals($filters)
            ->selectRaw('p.category, '.$this->outcomeColumns())
            ->groupBy('p.category')
            ->orderByDesc('submitted')
            ->get()
            ->map(fn ($r) => $this->withRate(['category' => $r->category] + $this->counts($r)))
            ->all();
    }

    /** Every active college (zeros included, so the page can offer "show all"), busiest first. */
    private function byCollege(array $filters): array
    {
        $rows = $this->proposals($filters)
            ->selectRaw('p.college_id, '.$this->outcomeColumns())
            ->groupBy('p.college_id')
            ->get()
            ->keyBy('college_id');
        $awarded = $this->awardedBy($filters, 'p.college_id');

        return DB::table('colleges')
            ->whereNull('deleted_at')
            ->where('status', 'active')
            ->when($filters['college_id'], fn ($q, $id) => $q->where('id', $id))
            ->orderBy('name')
            ->get(['id', 'name', 'code'])
            ->map(fn ($c) => $this->withRate([
                'id' => $c->id,
                'college' => $c->name,
                'code' => $c->code,
                'awarded' => (float) ($awarded[$c->id] ?? 0),
            ] + $this->counts($rows[$c->id] ?? null)))
            ->sortByDesc('submitted')
            ->values()
            ->all();
    }

    /**
     * Outcomes and money by theme (the proposal's focus area). The largest themes are
     * listed; the rest are grouped as "Other themes".
     *
     * @return list<array<string, mixed>>
     */
    private function byTheme(array $filters): array
    {
        $theme = "COALESCE(NULLIF(TRIM(p.focus_area), ''), 'Not specified')";
        $rows = $this->proposals($filters)
            ->selectRaw("{$theme} as theme, ".$this->outcomeColumns())
            ->groupBy('theme')
            ->orderByDesc('submitted')
            ->get();
        $awarded = $this->awardedBy($filters, $theme);

        $themes = $rows->map(fn ($r) => $this->withRate(['theme' => $r->theme, 'awarded' => (float) ($awarded[$r->theme] ?? 0)] + $this->counts($r)));
        if ($themes->count() <= self::MAX_THEMES) {
            return $themes->values()->all();
        }

        $rest = $themes->slice(self::MAX_THEMES - 1);

        return $themes->take(self::MAX_THEMES - 1)->push($this->withRate([
            'theme' => 'Other themes ('.$rest->count().')',
            'awarded' => $rest->sum('awarded'),
            'submitted' => $rest->sum('submitted'),
            'funded' => $rest->sum('funded'),
            'rejected' => $rest->sum('rejected'),
            'in_progress' => $rest->sum('in_progress'),
        ]))->values()->all();
    }

    /**
     * One row per call: applications, how far they got, money and gender — the year-end
     * comparison across calls. The call filter itself doesn't apply here.
     *
     * @return list<array<string, mixed>>
     */
    public function calls(array $filters): array
    {
        $filters = ['proposal_call_id' => null] + $filters;
        $proposals = $this->proposals($filters)
            ->leftJoin('users as u', 'u.id', '=', 'p.pi_user_id')
            ->get(['p.id', 'p.status', 'p.proposal_call_id', DB::raw("LOWER(COALESCE(u.gender, '')) as gender")])
            ->groupBy('proposal_call_id');
        $awarded = $this->awardedBy($filters, 'p.proposal_call_id');

        return DB::table('proposal_calls')
            ->whereIn('id', $proposals->keys())
            ->orderByDesc('academic_year')
            ->orderBy('title')
            ->get(['id', 'title', 'academic_year', 'category', 'funding_budget', 'slug'])
            ->map(function ($call) use ($proposals, $awarded) {
                $rows = $proposals[$call->id];
                $reached = $this->reached($rows);
                $funded = $rows->whereIn('status', self::FUNDED);
                $money = (float) ($awarded[$call->id] ?? 0);
                $budget = $call->funding_budget !== null ? (float) $call->funding_budget : null;

                return $this->withRate([
                    'id' => $call->id,
                    'title' => $call->title,
                    'academic_year' => $call->academic_year,
                    'category' => $call->category,
                    'is_legacy' => str_starts_with((string) $call->slug, 'legacy-manual-grants-'),
                    'stages' => collect(self::MILESTONES)->map(fn ($m, $i) => ['key' => $m['key'], 'label' => $m['label'], 'count' => $reached[$i]])->all(),
                    'awarded' => $money,
                    'budget' => $budget,
                    'budget_used_pct' => $budget ? round($money / $budget * 100, 1) : null,
                    'gender' => [
                        'female' => $rows->where('gender', 'female')->count(),
                        'male' => $rows->where('gender', 'male')->count(),
                        'not_specified' => $rows->whereNotIn('gender', ['female', 'male'])->count(),
                        'female_funded' => $funded->where('gender', 'female')->count(),
                        'male_funded' => $funded->where('gender', 'male')->count(),
                    ],
                    'submitted' => $rows->count(),
                    'funded' => $funded->count(),
                    'rejected' => $rows->whereIn('status', self::REJECTED)->count(),
                    'in_progress' => $rows->whereNotIn('status', [...self::FUNDED, ...self::REJECTED])->count(),
                ]);
            })
            ->values()
            ->all();
    }

    /**
     * Total awarded to funded proposals within the filters, grouped by an SQL expression
     * over the proposal (alias p).
     *
     * @return Collection<string, float>
     */
    private function awardedBy(array $filters, string $groupBy): Collection
    {
        return $this->proposals($filters)
            ->whereIn('p.status', self::FUNDED)
            ->join('awards as a', 'a.proposal_id', '=', 'p.id')
            ->selectRaw("{$groupBy} as group_key, SUM(a.awarded_amount) as total")
            ->groupBy('group_key')
            ->pluck('total', 'group_key')
            ->map(fn ($v) => (float) $v);
    }

    /** Every academic year (the year filter doesn't apply — this is the comparison across years). */
    private function byYear(array $filters): array
    {
        return $this->proposals(['academic_year' => null] + $filters)
            ->whereNotNull('p.academic_year')
            ->selectRaw('p.academic_year, '.$this->outcomeColumns())
            ->groupBy('p.academic_year')
            ->orderBy('p.academic_year')
            ->get()
            ->map(fn ($r) => $this->withRate(['academic_year' => $r->academic_year] + $this->counts($r)))
            ->all();
    }

    /** Submissions per month over the last 24 months (not filtered by academic year). */
    private function monthlySubmissions(array $filters): array
    {
        $counts = $this->proposals(['academic_year' => null] + $filters)
            ->whereNotNull('p.submitted_at')
            ->where('p.submitted_at', '>=', now()->subMonths(23)->startOfMonth())
            ->selectRaw("DATE_FORMAT(p.submitted_at, '%Y-%m') as month, COUNT(*) as submitted")
            ->groupBy('month')
            ->pluck('submitted', 'month');

        // Every month, including empty ones, so the line doesn't skip gaps.
        return collect(range(23, 0))->map(function ($ago) use ($counts) {
            $month = now()->subMonths($ago)->format('Y-m');

            return ['month' => $month, 'submitted' => (int) ($counts[$month] ?? 0)];
        })->all();
    }

    private function byResearchType(array $filters): array
    {
        return $this->proposals($filters)
            ->selectRaw("COALESCE(NULLIF(p.research_type, ''), 'Not specified') as type_label, ".$this->outcomeColumns())
            ->groupBy('type_label')
            ->orderByDesc('submitted')
            ->get()
            ->map(fn ($r) => $this->withRate(['research_type' => $r->type_label] + $this->counts($r)))
            ->all();
    }

    private function byGender(array $filters): array
    {
        return $this->proposals($filters)
            ->leftJoin('users as u', 'u.id', '=', 'p.pi_user_id')
            ->selectRaw("COALESCE(NULLIF(LOWER(u.gender), ''), 'not specified') as gender_label, ".$this->outcomeColumns())
            ->groupBy('gender_label')
            ->orderByDesc('submitted')
            ->get()
            ->map(fn ($r) => $this->withRate(['gender' => $r->gender_label] + $this->counts($r)))
            ->all();
    }

    /**
     * Money for funded proposals. The award-to-request ratio only compares proposals that
     * have both an itemised budget and an award, so legacy grants without a budget don't skew it.
     *
     * @return array<string, float|int|null>
     */
    private function money(array $filters): array
    {
        $funded = $this->proposals($filters)->whereIn('p.status', self::FUNDED)->pluck('p.id');

        $requestedBy = DB::table('proposal_budgets')->whereIn('proposal_id', $funded)
            ->groupBy('proposal_id')->selectRaw('proposal_id, SUM(amount) as total')->pluck('total', 'proposal_id');
        $awardedBy = DB::table('awards')->whereIn('proposal_id', $funded)
            ->groupBy('proposal_id')->selectRaw('proposal_id, SUM(awarded_amount) as total')->pluck('total', 'proposal_id');
        $disbursed = (float) DB::table('disbursements as d')
            ->join('budget_requests as br', 'br.id', '=', 'd.budget_request_id')
            ->whereIn('br.proposal_id', $funded)
            ->sum('d.amount');

        $comparable = $requestedBy->keys()->intersect($awardedBy->keys())->filter(fn ($id) => $requestedBy[$id] > 0);
        $comparableRequested = $comparable->sum(fn ($id) => (float) $requestedBy[$id]);
        $awarded = (float) $awardedBy->sum();

        return [
            'requested' => (float) $requestedBy->sum(),
            'awarded' => $awarded,
            'disbursed' => $disbursed,
            'award_ratio' => $comparableRequested > 0 ? round($comparable->sum(fn ($id) => (float) $awardedBy[$id]) / $comparableRequested * 100, 1) : null,
            'disbursed_ratio' => $awarded > 0 ? round($disbursed / $awarded * 100, 1) : null,
            'average_award' => $awardedBy->count() > 0 ? round($awarded / $awardedBy->count(), 2) : null,
            'awards' => $awardedBy->count(),
        ];
    }

    /** Stage timings (from Turnaround), reviewer speed, and how often blind reviewers disagreed. */
    private function review(array $filters): array
    {
        $report = $this->turnaround->report($filters);
        $ids = $this->proposals($filters)->pluck('p.id');

        $assignments = DB::table('review_assignments')
            ->whereIn('proposal_id', $ids)
            ->where('status', 'submitted')
            ->selectRaw('COUNT(*) as reviews, COUNT(DISTINCT reviewer_id) as reviewers,
                SUM(CASE WHEN due_date IS NOT NULL AND DATE(submitted_at) <= due_date THEN 1 ELSE 0 END) as on_time,
                SUM(CASE WHEN due_date IS NOT NULL THEN 1 ELSE 0 END) as with_due_date')
            ->first();

        $disagreements = DB::table('proposals')->whereIn('id', $ids)->where('review_disagreement', true)->count();
        $blindReviewed = DB::table('review_assignments as ra')
            ->join('evaluation_types as et', 'et.id', '=', 'ra.evaluation_type_id')
            ->whereIn('ra.proposal_id', $ids)
            ->where('ra.status', 'submitted')
            ->where('et.name', 'like', 'blind_review%')
            ->distinct()
            ->count('ra.proposal_id');

        return [
            'stages' => collect($report['stages'])->map(fn ($s) => [
                'label' => $s['label'],
                'median' => $s['median'],
                'target' => $s['target'],
                'count' => $s['count'],
            ])->all(),
            'reviewers' => (int) $assignments->reviewers,
            'reviews' => (int) $assignments->reviews,
            'reviews_per_reviewer' => $assignments->reviewers > 0 ? round($assignments->reviews / $assignments->reviewers, 1) : null,
            'average_review_days' => $report['reviewers']['average_days'],
            'overdue_reviews' => $report['reviewers']['overdue'],
            'on_time_rate' => $assignments->with_due_date > 0 ? round($assignments->on_time / $assignments->with_due_date * 100, 1) : null,
            'disagreements' => $disagreements,
            'disagreement_rate' => $blindReviewed > 0 ? round($disagreements / $blindReviewed * 100, 1) : null,
        ];
    }

    /**
     * Submissions forecast from completed academic years only, by linear trend. Shown only
     * with enough history and a reasonable fit; otherwise says why not.
     *
     * @return array<string, mixed>
     */
    private function forecast(array $filters): array
    {
        $currentStart = $this->startYear((string) DB::table('app_settings')->where('key', 'current_academic_year')->value('value')) ?? (int) now()->format('Y');

        $history = $this->proposals(['academic_year' => null] + $filters)
            ->whereNotNull('p.academic_year')
            ->select('p.academic_year', DB::raw('COUNT(*) as total'))
            ->groupBy('p.academic_year')
            ->get()
            // "2026" and "2026-2027" are the same academic year.
            ->groupBy(fn ($r) => $this->startYear($r->academic_year))
            ->map(fn ($rows, $start) => ['start' => (int) $start, 'total' => (int) $rows->sum('total')])
            ->filter(fn ($r) => $r['start'] > 0 && $r['start'] < $currentStart)
            ->sortBy('start')
            ->values();

        $label = fn (int $start) => $start.'-'.($start + 1);
        $base = ['history' => $history->map(fn ($r) => ['year' => $label($r['start']), 'actual' => $r['total']])->all(), 'predictions' => []];

        if ($history->count() < self::FORECAST_MIN_YEARS) {
            return $base + ['available' => false, 'reason' => 'A forecast needs at least '.self::FORECAST_MIN_YEARS.' completed academic years of data; there '.($history->count() === 1 ? 'is' : 'are').' '.$history->count().'.'];
        }

        $n = $history->count();
        $xs = $history->pluck('start')->map(fn ($s) => $s - $history->first()['start']);
        $ys = $history->pluck('total');
        $meanX = $xs->avg();
        $meanY = $ys->avg();
        $sxx = $xs->sum(fn ($x) => ($x - $meanX) ** 2);
        $slope = $sxx > 0 ? $xs->zip($ys)->sum(fn ($p) => ($p[0] - $meanX) * ($p[1] - $meanY)) / $sxx : 0;
        $intercept = $meanY - $slope * $meanX;
        $ssTot = $ys->sum(fn ($y) => ($y - $meanY) ** 2);
        $ssRes = $xs->zip($ys)->sum(fn ($p) => ($p[1] - ($slope * $p[0] + $intercept)) ** 2);
        $r2 = $ssTot > 0 ? round(1 - $ssRes / $ssTot, 2) : 1.0;

        if ($r2 < self::FORECAST_MIN_R2) {
            return $base + ['available' => false, 'r_squared' => $r2, 'reason' => 'Submissions have varied too much from year to year for a reliable trend (fit '.$r2.').'];
        }

        $lastStart = $history->last()['start'];
        $firstStart = $history->first()['start'];
        $predictions = collect(range(1, 2))->map(fn ($i) => [
            'year' => $label($lastStart + $i),
            'predicted' => max(0, (int) round($slope * ($lastStart + $i - $firstStart) + $intercept)),
        ])->all();

        return [
            'available' => true,
            'history' => $base['history'],
            'predictions' => $predictions,
            'slope' => round($slope, 1),
            'r_squared' => $r2,
        ];
    }

    /** Non-draft proposals within the filters (null = no filter). */
    private function proposals(array $filters): Builder
    {
        return DB::table('proposals as p')
            ->whereNull('p.deleted_at')
            ->where('p.status', '!=', 'draft')
            ->when($filters['academic_year'] ?? null, fn ($q, $year) => $q->where('p.academic_year', $year))
            ->when($filters['college_id'] ?? null, fn ($q, $id) => $q->where('p.college_id', $id))
            ->when($filters['category'] ?? null, fn ($q, $category) => $q->where('p.category', $category))
            ->when($filters['proposal_call_id'] ?? null, fn ($q, $callId) => $q->where('p.proposal_call_id', $callId));
    }

    private function outcomeColumns(): string
    {
        $funded = "'".implode("','", self::FUNDED)."'";
        $rejected = "'".implode("','", self::REJECTED)."'";

        return "COUNT(*) as submitted,
            SUM(CASE WHEN p.status IN ({$funded}) THEN 1 ELSE 0 END) as funded,
            SUM(CASE WHEN p.status IN ({$rejected}) THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN p.status NOT IN ({$funded}, {$rejected}) THEN 1 ELSE 0 END) as in_progress";
    }

    /** @return array{submitted: int, funded: int, rejected: int, in_progress: int} */
    private function counts(?object $row): array
    {
        return [
            'submitted' => (int) ($row->submitted ?? 0),
            'funded' => (int) ($row->funded ?? 0),
            'rejected' => (int) ($row->rejected ?? 0),
            'in_progress' => (int) ($row->in_progress ?? 0),
        ];
    }

    /** Adds decided and pass rate (funded ÷ decided; null until something is decided). */
    private function withRate(array $row): array
    {
        $decided = $row['funded'] + $row['rejected'];

        return $row + [
            'decided' => $decided,
            'pass_rate' => $decided > 0 ? round($row['funded'] / $decided * 100, 1) : null,
        ];
    }

    private function startYear(?string $academicYear): ?int
    {
        return preg_match('/(\d{4})/', (string) $academicYear, $m) ? (int) $m[1] : null;
    }
}
