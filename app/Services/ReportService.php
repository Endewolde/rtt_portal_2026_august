<?php

namespace App\Services;

use App\Jobs\GenerateReportJob;
use App\Models\ReportSnapshot;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    private const SYNC_MAX_MONTHS = 3;

    /**
     * Generate a report synchronously or queue it based on date range.
     *
     * @return ReportSnapshot  status=ready if sync, status=processing if queued
     */
    public function generate(string $type, array $filters, User $requestedBy): ReportSnapshot
    {
        $snapshot = ReportSnapshot::create([
            'report_type'  => $type,
            'filters'      => $filters,
            'status'       => 'processing',
            'requested_by' => $requestedBy->id,
        ]);

        if ($this->shouldQueue($filters)) {
            GenerateReportJob::dispatch($snapshot->id);

            return $snapshot;
        }

        try {
            $result = $this->runReport($type, $filters);
            $snapshot->update([
                'status'       => 'ready',
                'result'       => $result,
                'completed_at' => now(),
            ]);
        } catch (\Exception $e) {
            $snapshot->update(['status' => 'failed']);
            throw $e;
        }

        return $snapshot->fresh();
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
            'proposal_count_by_college'  => $this->proposalCountByCollege($filters),
            'reviewer_workload'          => $this->reviewerWorkload($filters),
            'approval_rate_by_category'  => $this->approvalRateByCategory($filters),
            'budget_utilization'         => $this->budgetUtilization($filters),
            'college_performance'        => $this->collegePerformance($filters),
            'review_progress_pipeline'   => $this->reviewProgressPipeline($filters),
            default => throw new \InvalidArgumentException("Unknown report type: {$type}"),
        };
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

        return $query->select(
            'c.name as college_name',
            DB::raw('COUNT(*) as total_proposals'),
            DB::raw("SUM(CASE WHEN p.status IN ('accepted','funded','midterm_evaluation','completed','archived') THEN 1 ELSE 0 END) as accepted"),
            DB::raw("ROUND(SUM(CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as rejection_rate_percent")
        )->groupBy('c.id', 'c.name')->get()->toArray();
    }

    private function reviewerWorkload(array $filters): array
    {
        $query = DB::table('review_assignments as ra')
            ->join('users as u', 'ra.reviewer_id', '=', 'u.id');

        if (! empty($filters['date_from'])) {
            $query->where('ra.assigned_at', '>=', $filters['date_from']);
        }
        if (! empty($filters['date_to'])) {
            $query->where('ra.assigned_at', '<=', $filters['date_to']);
        }

        return $query->select(
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

        return $query->select(
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
            })
            ->leftJoin('awards as a', 'p.id', '=', 'a.proposal_id');

        return $query->select(
            'c.name as college_name',
            DB::raw('COUNT(DISTINCT p.id) as proposals_submitted'),
            DB::raw("COUNT(DISTINCT CASE WHEN p.status IN ('accepted','funded','midterm_evaluation','completed','archived') THEN p.id END) as proposals_accepted"),
            DB::raw('COALESCE(SUM(DISTINCT a.awarded_amount), 0) as total_awarded'),
            DB::raw('(SELECT COUNT(*) FROM research_outputs ro WHERE ro.proposal_id IN (SELECT id FROM proposals WHERE college_id = c.id)) as outputs_produced'),
            DB::raw("(SELECT COUNT(*) FROM research_outputs ro WHERE ro.proposal_id IN (SELECT id FROM proposals WHERE college_id = c.id) AND ro.output_type = 'journal_article') as publications_count")
        )->groupBy('c.id', 'c.name')->get()->toArray();
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

        $counts = $query->select('status', DB::raw('COUNT(*) as count'))
            ->whereIn('status', $stages)
            ->groupBy('status')
            ->pluck('count', 'status');

        return collect($stages)->map(fn ($stage) => [
            'stage' => $stage,
            'count' => $counts[$stage] ?? 0,
        ])->toArray();
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
