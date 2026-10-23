<?php

namespace App\Services;

use App\Jobs\GenerateReportJob;
use App\Models\ReportSnapshot;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReportService
{
    private const SYNC_MAX_MONTHS = 3;

    /** Reports that open live, with filters, instead of being generated first. */
    public const LIVE_TYPES = [
        'proposal_count_by_category', 'proposal_count_by_college', 'proposal_trend_by_year', 'approval_rate_by_category',
        'review_progress_pipeline', 'college_performance', 'reviewer_workload', 'budget_utilization', 'complaint_summary',
    ];

    /** Live results are cached briefly so filters feel instant without serving stale numbers for long. */
    private const LIVE_CACHE_SECONDS = 300;

    /**
     * Whitelist of report-builder subjects. Dimension/metric/filter SQL fragments live
     * only here (never come from the client) — the client picks keys, we resolve them.
     * `filter_columns` lets every listed key be used as an equality WHERE filter (this
     * is also how the college-officer scoping enforced in ReportController::generate
     * applies — it just sets $filters['college_id']).
     */
    private const SUBJECTS = [
        'proposals' => [
            'from' => 'proposals as p',
            'joins' => [
                ['colleges as c', 'p.college_id', '=', 'c.id'],
            ],
            'base_where' => 'p.deleted_at IS NULL',
            'dimensions' => [
                'college' => 'c.name',
                'category' => 'p.category',
                'status' => 'p.status',
                'academic_year' => 'p.academic_year',
            ],
            'metrics' => [
                'count' => 'COUNT(*)',
                'funded_count' => "SUM(CASE WHEN p.status IN ('funded','accepted','completed','midterm_evaluation','archived') THEN 1 ELSE 0 END)",
                'rejected_count' => "SUM(CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END)",
            ],
            'filter_columns' => [
                'college_id' => 'p.college_id',
                'category' => 'p.category',
                'status' => 'p.status',
                'academic_year' => 'p.academic_year',
            ],
        ],
        'complaints' => [
            'from' => 'complaints as co',
            'joins' => [
                ['proposals as p', 'co.proposal_id', '=', 'p.id'],
                ['colleges as c', 'p.college_id', '=', 'c.id'],
            ],
            'dimensions' => [
                'college' => 'c.name',
                'status' => 'co.status',
                'level' => 'co.level',
                'complaint_type' => 'co.complaint_type',
            ],
            'metrics' => [
                'count' => 'COUNT(*)',
                'avg_resolution_days' => 'ROUND(AVG(CASE WHEN co.resolved_at IS NOT NULL THEN DATEDIFF(co.resolved_at, co.created_at) END), 1)',
            ],
            'filter_columns' => [
                'college_id' => 'p.college_id',
                'status' => 'co.status',
                'level' => 'co.level',
                'complaint_type' => 'co.complaint_type',
                'academic_year' => 'p.academic_year',
            ],
        ],
        'review_workload' => [
            'from' => 'review_assignments as ra',
            'joins' => [
                ['proposals as p', 'ra.proposal_id', '=', 'p.id'],
                ['colleges as c', 'p.college_id', '=', 'c.id'],
            ],
            'dimensions' => [
                'college' => 'c.name',
                'status' => 'ra.status',
            ],
            'metrics' => [
                'count' => 'COUNT(*)',
                'submitted_count' => "SUM(CASE WHEN ra.status = 'submitted' THEN 1 ELSE 0 END)",
                'avg_days_to_review' => 'ROUND(AVG(CASE WHEN ra.submitted_at IS NOT NULL THEN DATEDIFF(ra.submitted_at, ra.assigned_at) END), 1)',
            ],
            'filter_columns' => [
                'college_id' => 'p.college_id',
                'status' => 'ra.status',
                'academic_year' => 'p.academic_year',
            ],
        ],
    ];

    /**
     * Generate a report synchronously or queue it based on date range.
     *
     * @return ReportSnapshot status=ready if sync, status=processing if queued
     */
    public function generate(string $type, array $filters, User $requestedBy): ReportSnapshot
    {
        $snapshot = ReportSnapshot::create([
            'report_type' => $type,
            'filters' => $filters,
            'status' => 'processing',
            'requested_by' => $requestedBy->id,
        ]);

        if ($this->shouldQueue($filters)) {
            // Queued with a worker; without one it runs right after the response, so it can't sit at "processing" forever.
            GenerateReportJob::deliver($snapshot->id);

            return $snapshot;
        }

        try {
            $result = $this->runReport($type, $filters);
            $snapshot->update([
                'status' => 'ready',
                'result' => $result,
                'completed_at' => now(),
            ]);
        } catch (\Exception $e) {
            $snapshot->update(['status' => 'failed']);
            throw $e;
        }

        return $snapshot->fresh();
    }

    /**
     * A report's current figures for the given filters (academic_year, college_id,
     * category), served from a short cache.
     *
     * @param  array<string, mixed>  $filters
     * @return array{rows: array<int, mixed>, generated_at: string}
     */
    public function live(string $type, array $filters, bool $fresh = false): array
    {
        if (! in_array($type, self::LIVE_TYPES, true)) {
            throw new \InvalidArgumentException("Unknown report type: {$type}");
        }

        $filters = array_filter(array_intersect_key($filters, array_flip(['academic_year', 'college_id', 'category'])));
        ksort($filters);

        $key = 'report-live:'.$type.':'.md5(json_encode($filters));
        if ($fresh) {
            Cache::forget($key);
        }

        return Cache::remember($key, self::LIVE_CACHE_SECONDS, fn () => [
            'rows' => array_map(fn ($row) => (array) $row, $this->runReport($type, $filters)),
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Academic years and colleges the live filters can offer.
     *
     * @return array{years: array<int, string>, colleges: array<int, object>}
     */
    public function liveFilterOptions(?string $collegeId): array
    {
        return [
            'years' => DB::table('proposals')->whereNull('deleted_at')->whereNotNull('academic_year')
                ->when($collegeId, fn ($q) => $q->where('college_id', $collegeId))
                ->distinct()->orderByDesc('academic_year')->pluck('academic_year')->all(),
            'colleges' => DB::table('colleges')->where('status', 'active')
                ->when($collegeId, fn ($q) => $q->where('id', $collegeId))
                ->orderBy('name')->get(['id', 'name'])->all(),
        ];
    }

    /**
     * Run a report and return its result array.
     *
     * @throws \InvalidArgumentException for unknown report type
     */
    public function runReport(string $type, array $filters): array
    {
        return match ($type) {
            'proposal_count_by_category' => $this->proposalCountByCategory($filters),
            'proposal_count_by_college' => $this->proposalCountByCollege($filters),
            'proposal_trend_by_year' => $this->proposalTrendByYear($filters),
            'reviewer_workload' => $this->reviewerWorkload($filters),
            'approval_rate_by_category' => $this->approvalRateByCategory($filters),
            'budget_utilization' => $this->budgetUtilization($filters),
            'college_performance' => $this->collegePerformance($filters),
            'review_progress_pipeline' => $this->reviewProgressPipeline($filters),
            'complaint_summary' => $this->complaintSummary($filters),
            'custom_builder' => $this->customBuilder($filters),
            default => throw new \InvalidArgumentException("Unknown report type: {$type}"),
        };
    }

    /**
     * Available subjects/dimensions/metrics/filters for the report builder UI — the
     * client chooses only from these, never supplies raw SQL.
     *
     * @return array<string, array{dimensions: string[], metrics: string[], filters: string[]}>
     */
    public function builderOptions(): array
    {
        return collect(self::SUBJECTS)->map(fn ($config) => [
            'dimensions' => array_keys($config['dimensions']),
            'metrics' => array_keys($config['metrics']),
            'filters' => array_keys($config['filter_columns']),
        ])->toArray();
    }

    /**
     * Run a whitelist-validated ad-hoc report: client picks a subject plus any
     * combination of that subject's allowed dimensions/metrics. Column SQL never
     * comes from the client — only the whitelist keys they're choosing between.
     *
     * @throws \InvalidArgumentException for an unknown subject
     */
    private function customBuilder(array $filters): array
    {
        $subjectKey = $filters['subject'] ?? null;
        $config = self::SUBJECTS[$subjectKey] ?? null;

        if (! $config) {
            throw new \InvalidArgumentException('Unknown or missing report subject.');
        }

        $dimensions = array_values(array_unique(array_intersect(
            (array) ($filters['dimensions'] ?? []),
            array_keys($config['dimensions'])
        )));
        $metrics = array_values(array_unique(array_intersect(
            (array) ($filters['metrics'] ?? []),
            array_keys($config['metrics'])
        )));

        if (empty($metrics)) {
            $metrics = ['count'];
        }

        $query = DB::table($config['from']);
        foreach ($config['joins'] as [$table, $first, $operator, $second]) {
            $query->join($table, $first, $operator, $second);
        }
        if (! empty($config['base_where'])) {
            $query->whereRaw($config['base_where']);
        }

        $selects = [];
        foreach ($dimensions as $dim) {
            $selects[] = DB::raw("{$config['dimensions'][$dim]} as `{$dim}`");
        }
        foreach ($metrics as $metric) {
            $selects[] = DB::raw("{$config['metrics'][$metric]} as `{$metric}`");
        }
        $query->select($selects);

        if (! empty($dimensions)) {
            $query->groupBy(array_map(fn ($dim) => $config['dimensions'][$dim], $dimensions));
        }

        foreach ($config['filter_columns'] as $key => $column) {
            if (! empty($filters[$key])) {
                $query->where($column, $filters[$key]);
            }
        }

        return [
            'subject' => $subjectKey,
            'dimensions' => $dimensions,
            'metrics' => $metrics,
            'rows' => $query->get()->map(fn ($r) => (array) $r)->toArray(),
        ];
    }

    private function proposalCountByCategory(array $filters): array
    {
        $query = DB::table('proposals')->whereNull('deleted_at');

        if (! empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $query->where('college_id', $filters['college_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        return $query->select(
            'category',
            DB::raw('COUNT(*) as total'),
            DB::raw("SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted"),
            DB::raw("SUM(CASE WHEN status = 'validated' THEN 1 ELSE 0 END) as validated"),
            DB::raw("SUM(CASE WHEN status IN ('under_blind_review','blind_review_passed','under_open_defence') THEN 1 ELSE 0 END) as under_review"),
            DB::raw("SUM(CASE WHEN status IN ('accepted','funded','midterm_evaluation','completed') THEN 1 ELSE 0 END) as accepted"),
            DB::raw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected"),
            DB::raw("SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived")
        )->groupBy('category')->get()->toArray();
    }

    private function proposalCountByCollege(array $filters): array
    {
        $query = DB::table('proposals as p')
            ->join('colleges as c', 'p.college_id', '=', 'c.id')
            ->whereNull('p.deleted_at');

        if (! empty($filters['academic_year'])) {
            $query->where('p.academic_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $query->where('c.id', $filters['college_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('p.category', $filters['category']);
        }

        return $query->select(
            'c.id as college_id',
            'c.name as college_name',
            DB::raw('COUNT(*) as total_proposals'),
            DB::raw("SUM(CASE WHEN p.status IN ('accepted','funded','midterm_evaluation','completed','archived') THEN 1 ELSE 0 END) as accepted"),
            DB::raw("ROUND(SUM(CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as rejection_rate_percent")
        )->groupBy('c.id', 'c.name')->get()->toArray();
    }

    /**
     * Year-over-year trend — deliberately ignores the academic_year filter (the
     * whole point is comparing across years) but still respects college_id, so a
     * college officer can see their own multi-year trend rather than the whole
     * institution's.
     */
    private function proposalTrendByYear(array $filters): array
    {
        $query = DB::table('proposals')->whereNull('deleted_at')->whereNotNull('academic_year');

        if (! empty($filters['college_id'])) {
            $query->where('college_id', $filters['college_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        return $query->select(
            'academic_year',
            DB::raw('COUNT(*) as total'),
            DB::raw("SUM(CASE WHEN status NOT IN ('draft') THEN 1 ELSE 0 END) as submitted"),
            DB::raw("SUM(CASE WHEN status IN ('funded','midterm_evaluation','completed','archived') THEN 1 ELSE 0 END) as funded"),
            DB::raw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected"),
            DB::raw("ROUND(SUM(CASE WHEN status IN ('funded','midterm_evaluation','completed','archived') THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN status NOT IN ('draft') THEN 1 ELSE 0 END), 0), 1) as funded_rate_percent"
            )
        )->groupBy('academic_year')->orderBy('academic_year')->get()->toArray();
    }

    private function reviewerWorkload(array $filters): array
    {
        $query = DB::table('review_assignments as ra')
            ->join('users as u', 'ra.reviewer_id', '=', 'u.id')
            ->join('proposals as p', 'ra.proposal_id', '=', 'p.id');

        if (! empty($filters['date_from'])) {
            $query->where('ra.assigned_at', '>=', $filters['date_from']);
        }
        if (! empty($filters['date_to'])) {
            $query->where('ra.assigned_at', '<=', $filters['date_to']);
        }
        if (! empty($filters['college_id'])) {
            $query->where('p.college_id', $filters['college_id']);
        }
        if (! empty($filters['academic_year'])) {
            $query->where('p.academic_year', $filters['academic_year']);
        }
        if (! empty($filters['category'])) {
            $query->where('p.category', $filters['category']);
        }

        return $query->select(
            'u.id as reviewer_id',
            'u.name as reviewer_name',
            DB::raw('COUNT(*) as total_assigned'),
            DB::raw("SUM(CASE WHEN ra.status = 'submitted' THEN 1 ELSE 0 END) as submitted"),
            DB::raw("SUM(CASE WHEN ra.status = 'pending' THEN 1 ELSE 0 END) as pending"),
            DB::raw('ROUND(AVG(CASE WHEN ra.submitted_at IS NOT NULL THEN DATEDIFF(ra.submitted_at, ra.assigned_at) END), 1) as average_days_to_review')
        )->groupBy('u.id', 'u.name')->get()->toArray();
    }

    private function approvalRateByCategory(array $filters): array
    {
        $query = DB::table('proposals')->whereNull('deleted_at');

        if (! empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $query->where('college_id', $filters['college_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        return $query->select(
            'category',
            DB::raw('COUNT(*) as total_submitted'),
            DB::raw("SUM(CASE WHEN status IN ('accepted','funded','midterm_evaluation','completed','archived') THEN 1 ELSE 0 END) as total_accepted"),
            DB::raw("ROUND(SUM(CASE WHEN status IN ('accepted','funded','midterm_evaluation','completed','archived') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as approval_rate_percent"),
            DB::raw("ROUND(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as rejection_rate_percent")
        )->groupBy('category')->get()->toArray();
    }

    private function budgetUtilization(array $filters): array
    {
        $query = DB::table('budget_allocations as ba')
            ->join('proposals as p', 'ba.proposal_id', '=', 'p.id')
            ->where('ba.allocation_type', 'proposal')
            ->whereNotNull('ba.proposal_id');

        if (! empty($filters['academic_year'])) {
            $query->where('ba.fiscal_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $query->where('ba.college_id', $filters['college_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('p.category', $filters['category']);
        }

        return $query->select(
            'p.id as proposal_id',
            'p.title as proposal_title',
            'p.tracker_number',
            'ba.total_amount as allocated',
            DB::raw('COALESCE((SELECT SUM(d.amount) FROM disbursements d JOIN budget_requests br ON d.budget_request_id = br.id WHERE br.proposal_id = p.id), 0) as disbursed'),
            DB::raw('COALESCE((SELECT SUM(bs.total_spent) FROM budget_settlements bs JOIN budget_requests br ON bs.budget_request_id = br.id WHERE br.proposal_id = p.id AND bs.status = "finance_verified"), 0) as settled')
        )->get()->map(function ($row) {
            $row->utilization_percent = $row->allocated > 0
                ? round(($row->disbursed / $row->allocated) * 100, 2)
                : 0;

            return $row;
        })->toArray();
    }

    private function collegePerformance(array $filters): array
    {
        $query = DB::table('colleges as c')
            ->leftJoin('proposals as p', function ($join) use ($filters) {
                $join->on('c.id', '=', 'p.college_id')->whereNull('p.deleted_at');
                if (! empty($filters['academic_year'])) {
                    $join->where('p.academic_year', $filters['academic_year']);
                }
                if (! empty($filters['category'])) {
                    $join->where('p.category', $filters['category']);
                }
            })
            ->leftJoin('awards as a', 'p.id', '=', 'a.proposal_id');

        if (! empty($filters['college_id'])) {
            $query->where('c.id', $filters['college_id']);
        }

        // Outputs count against the same proposals as the rest of the row: same year and category.
        $outputs = fn (?string $outputType) => DB::table('research_outputs as ro')
            ->join('proposals as op', 'op.id', '=', 'ro.proposal_id')
            ->whereColumn('op.college_id', 'c.id')
            ->whereNull('op.deleted_at')
            ->when($filters['academic_year'] ?? null, fn ($q, $year) => $q->where('op.academic_year', $year))
            ->when($filters['category'] ?? null, fn ($q, $category) => $q->where('op.category', $category))
            ->when($outputType, fn ($q, $type) => $q->where('ro.output_type', $type))
            ->selectRaw('COUNT(*)');

        return $query->select(
            'c.id as college_id',
            'c.name as college_name',
            DB::raw('COUNT(DISTINCT p.id) as proposals_submitted'),
            DB::raw("COUNT(DISTINCT CASE WHEN p.status IN ('accepted','funded','midterm_evaluation','completed','archived') THEN p.id END) as proposals_accepted"),
            DB::raw('COALESCE(SUM(DISTINCT a.awarded_amount), 0) as total_awarded'),
        )
            ->selectSub($outputs(null), 'outputs_produced')
            ->selectSub($outputs('journal_article'), 'publications_count')
            ->groupBy('c.id', 'c.name')->get()->toArray();
    }

    private function reviewProgressPipeline(array $filters): array
    {
        $stages = [
            'submitted', 'validated', 'under_blind_review',
            'blind_review_passed', 'under_open_defence',
            'accepted', 'funded', 'midterm_evaluation', 'completed',
        ];

        $query = DB::table('proposals')->whereNull('deleted_at');

        if (! empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $query->where('college_id', $filters['college_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        $counts = $query->select('status', DB::raw('COUNT(*) as count'))
            ->whereIn('status', $stages)
            ->groupBy('status')
            ->pluck('count', 'status');

        return collect($stages)->map(fn ($stage) => [
            'stage' => $stage,
            'count' => $counts[$stage] ?? 0,
        ])->toArray();
    }

    /** Complaint volume, resolution outcomes, and average resolution time, broken down by college. */
    private function complaintSummary(array $filters): array
    {
        $query = DB::table('complaints as co')
            ->join('proposals as p', 'co.proposal_id', '=', 'p.id')
            ->join('colleges as c', 'p.college_id', '=', 'c.id');

        if (! empty($filters['academic_year'])) {
            $query->where('p.academic_year', $filters['academic_year']);
        }
        if (! empty($filters['college_id'])) {
            $query->where('c.id', $filters['college_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('p.category', $filters['category']);
        }

        return $query->select(
            'c.id as college_id',
            'c.name as college_name',
            DB::raw('COUNT(*) as total_complaints'),
            DB::raw("SUM(CASE WHEN co.status IN ('open','under_review','escalated') THEN 1 ELSE 0 END) as unresolved"),
            DB::raw("SUM(CASE WHEN co.status = 'resolved' THEN 1 ELSE 0 END) as resolved"),
            DB::raw("SUM(CASE WHEN co.status = 'dismissed' THEN 1 ELSE 0 END) as dismissed"),
            DB::raw("SUM(CASE WHEN co.level = 'college' THEN 1 ELSE 0 END) as level_1_college"),
            DB::raw("SUM(CASE WHEN co.level = 'officer' THEN 1 ELSE 0 END) as level_2_officer"),
            DB::raw('ROUND(AVG(CASE WHEN co.resolved_at IS NOT NULL THEN DATEDIFF(co.resolved_at, co.created_at) END), 1) as avg_resolution_days')
        )->groupBy('c.id', 'c.name')->orderByDesc('total_complaints')->get()->toArray();
    }

    private function shouldQueue(array $filters): bool
    {
        if (! empty($filters['date_from']) && ! empty($filters['date_to'])) {
            $months = Carbon::parse($filters['date_from'])
                ->diffInMonths(Carbon::parse($filters['date_to']));

            return $months > self::SYNC_MAX_MONTHS;
        }

        return false;
    }
}
