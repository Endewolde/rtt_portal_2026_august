<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AnnualReportService
{
    /** A proposal counts as funded from the award onwards, including after it moves on to mid-term or completion. */
    private const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    /**
     * Each section with what it shows when it can't be compiled, so one broken
     * section leaves the rest of the report readable instead of failing it all.
     */
    private const EMPTY_SECTIONS = [
        'proposals' => ['total' => 0, 'funded' => 0, 'completed' => 0, 'rejected' => 0, 'by_status' => [], 'by_category' => []],
        'finance' => ['allocated' => 0, 'awarded' => 0, 'disbursed' => 0, 'settled' => 0, 'utilization' => 0, 'paid_of_awarded' => 0],
        'reviews' => ['total' => 0, 'completed' => 0, 'rate' => 0, 'reviewers' => 0],
        'outputs' => ['total' => 0, 'by_type' => []],
        'impacts' => ['total' => 0, 'by_type' => []],
        'colleges' => [],
        'calls' => [],
    ];

    public function compile(int $startYear, int $endYear): array
    {
        $ay = "{$startYear}-{$endYear}"; // e.g. "2026-2027" — matches proposals.academic_year

        $report = [
            'academic_year' => $ay,
            'start_year' => $startYear,
            'end_year' => $endYear,
        ];
        $unavailable = [];

        foreach (self::EMPTY_SECTIONS as $section => $empty) {
            try {
                $report[$section] = $this->{$section}($ay);
            } catch (\Throwable $e) {
                Log::error("Annual report {$ay}: the {$section} section failed — {$e->getMessage()}", ['exception' => $e]);
                $report[$section] = $empty;
                $unavailable[] = $section;
            }
        }

        return $report + [
            'unavailable' => $unavailable,
            'generated_at' => now()->format('d M Y H:i'),
        ];
    }

    /** @return array<string, mixed> */
    protected function proposals(string $ay): array
    {
        $byStatus = DB::table('proposals')
            ->where('academic_year', $ay)
            ->where('status', '!=', 'draft')
            ->whereNull('deleted_at')
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $byCategory = DB::table('proposals')
            ->where('academic_year', $ay)
            ->where('status', '!=', 'draft')
            ->whereNull('deleted_at')
            ->selectRaw('category, count(*) as total')
            ->groupBy('category')
            ->pluck('total', 'category')
            ->toArray();

        return [
            'total' => array_sum($byStatus),
            'funded' => array_sum(array_intersect_key($byStatus, array_flip(self::FUNDED_STATUSES))),
            'completed' => (int) ($byStatus['completed'] ?? 0),
            'rejected' => (int) ($byStatus['rejected'] ?? 0),
            'by_status' => $byStatus,
            'by_category' => $byCategory,
        ];
    }

    /** @return array<string, mixed> */
    public function finance(string $ay): array
    {
        // budget_allocations uses fiscal_year in the same "YYYY-YYYY" format
        $allocated = (float) DB::table('budget_allocations')
            ->where('fiscal_year', $ay)
            ->sum('total_amount');

        // disbursements → budget_requests → proposals.academic_year
        $disbursed = (float) DB::table('disbursements')
            ->join('budget_requests', 'disbursements.budget_request_id', '=', 'budget_requests.id')
            ->join('proposals', 'budget_requests.proposal_id', '=', 'proposals.id')
            ->where('proposals.academic_year', $ay)
            ->sum('disbursements.amount');

        // What was awarded to the year's funded proposals, and what was spent and verified.
        $awarded = (float) DB::table('awards')
            ->join('proposals', 'awards.proposal_id', '=', 'proposals.id')
            ->where('proposals.academic_year', $ay)
            ->whereNull('proposals.deleted_at')
            ->whereIn('proposals.status', self::FUNDED_STATUSES)
            ->sum('awards.awarded_amount');

        $settled = (float) DB::table('budget_settlements')
            ->join('budget_requests', 'budget_settlements.budget_request_id', '=', 'budget_requests.id')
            ->join('proposals', 'budget_requests.proposal_id', '=', 'proposals.id')
            ->where('proposals.academic_year', $ay)
            ->whereNotNull('budget_settlements.finance_verified_at')
            ->sum('budget_settlements.total_spent');

        return [
            'allocated' => $allocated,
            'awarded' => $awarded,
            'disbursed' => $disbursed,
            'settled' => $settled,
            'utilization' => $allocated > 0 ? round(($disbursed / $allocated) * 100, 1) : 0,
            'paid_of_awarded' => $awarded > 0 ? round(($disbursed / $awarded) * 100, 1) : 0,
        ];
    }

    /** @return array<string, mixed> */
    protected function reviews(string $ay): array
    {
        $base = DB::table('review_assignments')
            ->join('proposals', 'review_assignments.proposal_id', '=', 'proposals.id')
            ->where('proposals.academic_year', $ay);

        // Cancelled and declined assignments were never owed; submitted ones are done.
        $owed = (clone $base)->whereNotIn('review_assignments.status', ['cancelled', 'declined']);
        $total = (clone $owed)->count();
        $completed = (clone $owed)->whereIn('review_assignments.status', ['submitted', 'completed'])->count();

        return [
            'total' => $total,
            'completed' => $completed,
            'rate' => $total > 0 ? round(($completed / $total) * 100, 1) : 0,
            'reviewers' => (clone $owed)->distinct()->count('review_assignments.reviewer_id'),
        ];
    }

    /** @return array<string, mixed> */
    protected function outputs(string $ay): array
    {
        $byType = DB::table('research_outputs')
            ->join('proposals', 'research_outputs.proposal_id', '=', 'proposals.id')
            ->where('proposals.academic_year', $ay)
            ->selectRaw('research_outputs.output_type, count(*) as total')
            ->groupBy('research_outputs.output_type')
            ->pluck('total', 'output_type')
            ->toArray();

        return ['total' => array_sum($byType), 'by_type' => $byType];
    }

    /** @return array<string, mixed> */
    protected function impacts(string $ay): array
    {
        $byType = DB::table('research_impacts')
            ->join('proposals', 'research_impacts.proposal_id', '=', 'proposals.id')
            ->where('proposals.academic_year', $ay)
            ->selectRaw('research_impacts.type, count(*) as total')
            ->groupBy('research_impacts.type')
            ->pluck('total', 'type')
            ->toArray();

        return ['total' => array_sum($byType), 'by_type' => $byType];
    }

    /** @return array<array<string, mixed>> */
    protected function colleges(string $ay): array
    {
        return DB::table('proposals')
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->where('proposals.academic_year', $ay)
            ->where('proposals.status', '!=', 'draft')
            ->whereNull('proposals.deleted_at')
            ->selectRaw("colleges.name, count(*) as submitted, sum(case when proposals.status in ('".implode("','", self::FUNDED_STATUSES)."') then 1 else 0 end) as funded")
            ->groupBy('colleges.id', 'colleges.name')
            ->orderByDesc('submitted')
            ->get()
            ->map(fn ($r) => ['name' => $r->name, 'submitted' => (int) $r->submitted, 'funded' => (int) $r->funded])
            ->toArray();
    }

    /** @return array<array<string, mixed>> */
    protected function calls(string $ay): array
    {
        return DB::table('proposal_calls')
            ->where('academic_year', $ay)
            ->select('title', 'category', 'status', 'start_date', 'end_date')
            ->orderBy('start_date')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();
    }
}
