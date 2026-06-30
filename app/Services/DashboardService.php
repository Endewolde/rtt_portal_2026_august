<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    private const TTL = 300;

    /**
     * Get all dashboard widgets for the authenticated user.
     * Cached in Redis with 5-minute TTL keyed by user_id.
     */
    public function getWidgets(User $user): array
    {
        $cacheKey = "dashboard:{$user->id}";

        return Cache::remember($cacheKey, self::TTL, function () use ($user) {
            $widgets = [];

            $widgets['proposals_by_status'] = $this->proposalsByStatus($user);
            $widgets['pending_tasks'] = $this->pendingTasks($user);
            $widgets['recent_notifications'] = $this->recentNotifications($user);

            if ($user->hasAnyRole(['super_admin', 'central_officer', 'support_officer', 'finance_officer'])) {
                $widgets['budget_utilization_summary'] = $this->budgetUtilizationSummary();
            }

            if ($user->hasRole('staff')) {
                $widgets['my_proposals'] = $this->myProposals($user);
            }

            if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
                $widgets['proposal_trend_chart'] = $this->proposalTrendChart();
            }

            return $widgets;
        });
    }

    /**
     * Invalidate dashboard cache for a user.
     */
    public function invalidate(string $userId): void
    {
        Cache::forget("dashboard:{$userId}");
    }

    private function proposalsByStatus(User $user): array
    {
        $query = DB::table('proposals')->whereNull('deleted_at');

        if ($user->hasRole('college_officer')) {
            $query->where('college_id', $user->college_id);
        } elseif ($user->hasRole('staff')) {
            $query->where('pi_user_id', $user->id);
        } elseif ($user->hasRole('college_officer')) {
            $query->where('department_id', $user->department_id);
        }

        return $query->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();
    }

    private function pendingTasks(User $user): array
    {
        $tasks = [];

        if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
            $tasks['awaiting_validation'] = DB::table('proposals')
                ->where('status', 'submitted')
                ->whereNull('deleted_at')
                ->count();

            $tasks['blind_review_in_progress'] = DB::table('proposals')
                ->where('status', 'under_blind_review')
                ->whereNull('deleted_at')
                ->count();

            $tasks['open_defence_pending'] = DB::table('proposals')
                ->where('status', 'under_open_defence')
                ->whereNull('deleted_at')
                ->count();

            $tasks['central_evaluation_pending'] = DB::table('proposals')
                ->where('status', 'accepted')
                ->whereNull('deleted_at')
                ->count();

            $tasks['open_complaints'] = DB::table('complaints')
                ->where('assigned_to', $user->id)
                ->whereIn('status', ['open', 'under_review'])
                ->count();
        }

        if ($user->hasRole('college_officer')) {
            $tasks['budget_requests_pending'] = DB::table('budget_requests as br')
                ->join('proposals as p', 'br.proposal_id', '=', 'p.id')
                ->where('p.college_id', $user->college_id)
                ->where('br.status', 'submitted')
                ->count();

            $tasks['midterm_to_score'] = DB::table('midterm_evaluations as me')
                ->join('proposals as p', 'me.proposal_id', '=', 'p.id')
                ->where('p.college_id', $user->college_id)
                ->where('me.status', 'report_submitted')
                ->count();
        }

        if ($user->hasRole('staff')) {
            $tasks['reviews_pending'] = DB::table('review_assignments')
                ->where('reviewer_id', $user->id)
                ->whereIn('status', ['pending', 'in_progress'])
                ->count();

            $tasks['reviews_overdue'] = DB::table('review_assignments')
                ->where('reviewer_id', $user->id)
                ->whereIn('status', ['pending', 'in_progress'])
                ->where('due_date', '<', now()->toDateString())
                ->count();
        }

        if ($user->hasRole('support_officer')) {
            $tasks['disbursements_pending'] = DB::table('budget_requests')
                ->where('status', 'approved')
                ->count();

            $tasks['settlements_to_finalize'] = DB::table('budget_settlements')
                ->where('status', 'college_verified')
                ->count();
        }

        if ($user->hasRole('staff')) {
            $tasks['signatures_required'] = DB::table('form_signatures as fs')
                ->join('budget_requests as br', 'fs.budget_request_id', '=', 'br.id')
                ->join('proposals as p', 'br.proposal_id', '=', 'p.id')
                ->where('p.pi_user_id', $user->id)
                ->where('fs.status', 'pending')
                ->count();

            $tasks['drafts_in_progress'] = DB::table('proposals')
                ->where('pi_user_id', $user->id)
                ->where('status', 'draft')
                ->whereNull('deleted_at')
                ->count();
        }

        return $tasks;
    }

    private function recentNotifications(User $user): array
    {
        return DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->whereNull('read_at')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'type' => $n->type,
                'data' => json_decode($n->data, true),
                'created_at' => $n->created_at,
            ])
            ->toArray();
    }

    private function budgetUtilizationSummary(): array
    {
        $fiscalYear = now()->year.'/'.(now()->year + 1);

        return [
            'fiscal_year' => $fiscalYear,
            'total_allocated' => DB::table('budget_allocations')
                ->where('allocation_type', 'college')
                ->where('fiscal_year', $fiscalYear)
                ->sum('total_amount'),
            'total_disbursed' => DB::table('disbursements')
                ->whereYear('disbursed_at', now()->year)
                ->sum('amount'),
            'total_settled' => DB::table('budget_settlements')
                ->where('status', 'finance_verified')
                ->whereYear('finance_verified_at', now()->year)
                ->sum('total_spent'),
        ];
    }

    private function reviewerQueue(User $user): array
    {
        return DB::table('review_assignments as ra')
            ->join('proposals as p', 'ra.proposal_id', '=', 'p.id')
            ->where('ra.reviewer_id', $user->id)
            ->whereIn('ra.status', ['pending', 'in_progress'])
            ->select(
                'p.tracker_number',
                'p.title',
                'ra.id as assignment_id',
                'ra.due_date',
                'ra.status',
                DB::raw('DATEDIFF(ra.due_date, CURDATE()) as days_remaining')
            )
            ->orderBy('ra.due_date', 'asc')
            ->limit(10)
            ->get()
            ->toArray();
    }

    private function myProposals(User $user): array
    {
        return DB::table('proposals')
            ->where('pi_user_id', $user->id)
            ->whereNull('deleted_at')
            ->select('id', 'tracker_number', 'title', 'status', 'submitted_at', 'current_wizard_step')
            ->orderByDesc('updated_at')
            ->limit(10)
            ->get()
            ->toArray();
    }

    private function proposalTrendChart(): array
    {
        $months = collect(range(11, 0))->map(fn ($ago) => [
            'month' => now()->subMonths($ago)->format('Y-m'),
            'label' => now()->subMonths($ago)->format('M Y'),
        ]);

        $counts = DB::table('proposals')
            ->whereNull('deleted_at')
            ->where('submitted_at', '>=', now()->subMonths(12))
            ->whereNotNull('submitted_at')
            ->select(
                DB::raw("DATE_FORMAT(submitted_at, '%Y-%m') as month"),
                'category',
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('month', 'category')
            ->get()
            ->groupBy('month');

        return $months->map(function ($m) use ($counts) {
            $d = $counts->get($m['month'], collect());

            return [
                'month' => $m['label'],
                'research' => $d->where('category', 'research')->sum('count'),
                'community_engagement' => $d->where('category', 'community_engagement')->sum('count'),
                'technology_transfer' => $d->where('category', 'technology_transfer')->sum('count'),
                'total' => $d->sum('count'),
            ];
        })->values()->toArray();
    }
}
