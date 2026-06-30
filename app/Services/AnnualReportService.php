<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class AnnualReportService
{
    public function compile(int $startYear, int $endYear): array
    {
        $ay = "{$startYear}-{$endYear}"; // e.g. "2026-2027" — matches proposals.academic_year

        return [
            'academic_year' => $ay,
            'start_year' => $startYear,
            'end_year' => $endYear,
            'proposals' => $this->proposals($ay),
            'finance' => $this->finance($ay),
            'reviews' => $this->reviews($ay),
            'outputs' => $this->outputs($ay),
            'impacts' => $this->impacts($ay),
            'colleges' => $this->colleges($ay),
            'calls' => $this->calls($ay),
            'generated_at' => now()->format('d M Y H:i'),
        ];
    }

    /** @return array<string, mixed> */
    private function proposals(string $ay): array
    {
        $byStatus = DB::table('proposals')
            ->where('academic_year', $ay)
            ->where('status', '!=', 'draft')
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $byCategory = DB::table('proposals')
            ->where('academic_year', $ay)
            ->where('status', '!=', 'draft')
            ->selectRaw('category, count(*) as total')
            ->groupBy('category')
            ->pluck('total', 'category')
            ->toArray();

        return [
            'total' => array_sum($byStatus),
            'funded' => (int) ($byStatus['funded'] ?? 0),
            'completed' => (int) ($byStatus['completed'] ?? 0),
            'rejected' => (int) ($byStatus['rejected'] ?? 0),
            'by_status' => $byStatus,
            'by_category' => $byCategory,
        ];
    }

    /** @return array<string, mixed> */
    private function finance(string $ay): array
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

        return [
            'allocated' => $allocated,
            'disbursed' => $disbursed,
            'utilization' => $allocated > 0 ? round(($disbursed / $allocated) * 100, 1) : 0,
        ];
    }

    /** @return array<string, mixed> */
    private function reviews(string $ay): array
    {
        $base = DB::table('review_assignments')
            ->join('proposals', 'review_assignments.proposal_id', '=', 'proposals.id')
            ->where('proposals.academic_year', $ay);

        $total = (clone $base)->count();
        $completed = (clone $base)->where('review_assignments.status', 'completed')->count();

        return [
            'total' => $total,
            'completed' => $completed,
            'rate' => $total > 0 ? round(($completed / $total) * 100, 1) : 0,
        ];
    }

    /** @return array<string, mixed> */
    private function outputs(string $ay): array
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
    private function impacts(string $ay): array
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
    private function colleges(string $ay): array
    {
        return DB::table('proposals')
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->where('proposals.academic_year', $ay)
            ->selectRaw('colleges.name, count(*) as submitted, sum(case when proposals.status = "funded" then 1 else 0 end) as funded')
            ->groupBy('colleges.id', 'colleges.name')
            ->orderByDesc('submitted')
            ->get()
            ->map(fn ($r) => ['name' => $r->name, 'submitted' => (int) $r->submitted, 'funded' => (int) $r->funded])
            ->toArray();
    }

    /** @return array<array<string, mixed>> */
    private function calls(string $ay): array
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
