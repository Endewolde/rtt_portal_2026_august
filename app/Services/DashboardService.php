<?php

namespace App\Services;

use App\Models\User;
use App\Support\Programmes;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    private const TTL = 300;

    /** Bumped when the widgets' shape changes, so nobody is served an older cached version. */
    private const CACHE_VERSION = 'v2';

    private const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    /** Review work still owed (cancelled, voided and declined assignments are not). */
    private const OPEN_REVIEW_STATUSES = ['pending', 'accepted', 'in_progress'];

    /**
     * Get all dashboard widgets for the authenticated user.
     * Cached in Redis with 5-minute TTL keyed by user_id.
     */
    public function getWidgets(User $user): array
    {
        $cacheKey = $this->cacheKey($user->id);

        return Cache::remember($cacheKey, self::TTL, function () use ($user) {
            $widgets = [];

            $scope = $user->accessScope();

            $widgets['proposals_by_status'] = $this->proposalsByStatus($user);
            $widgets['pending_tasks'] = $this->pendingTasks($user);
            $widgets['recent_notifications'] = $this->recentNotifications($user);

            // Headline numbers for officers, counted within what they oversee.
            if (! $scope->isOwn()) {
                $widgets['headline'] = $this->headline($user);
            }

            if ($user->can('funds.disburse') || ($scope->isAll() && $user->can('analytics.view'))) {
                $widgets['budget_utilization_summary'] = $this->budgetUtilizationSummary();
            }

            if ($user->can('proposals.submit')) {
                $widgets['my_proposals'] = $this->myProposals($user);
            }

            // A college officer sees their college's latest proposals.
            if ($scope->isCollege()) {
                $widgets['college_proposals'] = $this->scopedProposals($user);
            }

            if (! $scope->isOwn() && $user->can('analytics.view')) {
                $widgets['proposal_trend_chart'] = $this->proposalTrendChart($user);
            }

            return $widgets;
        });
    }

    /** Proposals this user oversees: everything, their college's or their programmes'. */
    private function scoped(User $user): Builder
    {
        $query = DB::table('proposals')->whereNull('proposals.deleted_at');
        $user->accessScope()->constrain($query, 'proposals', fn ($q) => $q->where('proposals.pi_user_id', $user->id));

        return $query;
    }

    /**
     * @return array{academic_year: string, submitted: int, under_review: int, funded: int, active_calls: int}
     */
    private function headline(User $user): array
    {
        $year = $this->academicYear();
        $scope = $user->accessScope();

        return [
            'academic_year' => $year,
            'submitted' => $this->scoped($user)->where('academic_year', $year)->whereNotNull('submitted_at')->count(),
            'under_review' => $this->scoped($user)->whereIn('status', ['submitted', 'validated', 'under_blind_review', 'blind_review_passed', 'under_open_defence', 'accepted'])->count(),
            'funded' => $this->scoped($user)->whereIn('status', self::FUNDED_STATUSES)->count(),
            'active_calls' => DB::table('proposal_calls')->whereNull('deleted_at')->where('status', 'active')
                ->when($scope->isCategory(), fn ($q) => $q->whereIn('category', $scope->categories))
                ->count(),
        ];
    }

    /** The latest proposals a college officer oversees (drafts are the researchers' own business). */
    private function scopedProposals(User $user): array
    {
        return $this->scoped($user)
            ->where('status', '!=', 'draft')
            ->select('id', 'tracker_number', 'title', 'status', 'submitted_at')
            ->orderByDesc('updated_at')
            ->limit(10)
            ->get()
            ->toArray();
    }

    private function cacheKey(string $userId): string
    {
        return 'dashboard:'.self::CACHE_VERSION.":{$userId}";
    }

    private function academicYear(): string
    {
        $year = (string) DB::table('app_settings')->where('key', 'current_academic_year')->value('value');

        return preg_match('/^\d{4}-\d{4}$/', $year) ? $year : now()->year.'-'.(now()->year + 1);
    }

    /**
     * Invalidate dashboard cache for a user.
     */
    public function invalidate(string $userId): void
    {
        Cache::forget($this->cacheKey($userId));
    }

    private function proposalsByStatus(User $user): array
    {
        $query = DB::table('proposals')->whereNull('deleted_at');

        $user->accessScope()->constrain($query, 'proposals', fn ($q) => $q->where('proposals.pi_user_id', $user->id));

        return $query->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();
    }

    private function pendingTasks(User $user): array
    {
        $tasks = [];

        if ($user->can('proposals.validate') && ($user->accessScope()->isAll() || $user->accessScope()->isCategory())) {
            $tasks['awaiting_validation'] = $this->scoped($user)->where('status', 'submitted')->count();
            $tasks['blind_review_in_progress'] = $this->scoped($user)->where('status', 'under_blind_review')->count();
            $tasks['open_defence_pending'] = $this->scoped($user)->where('status', 'under_open_defence')->count();
            $tasks['central_evaluation_pending'] = $this->scoped($user)->where('status', 'accepted')->count();

            $tasks['open_complaints'] = DB::table('complaints')
                ->where('assigned_to', $user->id)
                ->whereIn('status', ['open', 'under_review'])
                ->count();
        }

        if ($user->can('budget_requests.approve_college') && $user->accessScope()->isCollege()) {
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

        // Anyone with reviews to do sees them, whatever their role.
        $openReviews = DB::table('review_assignments')->where('reviewer_id', $user->id)->whereIn('status', self::OPEN_REVIEW_STATUSES);
        $reviewsPending = (clone $openReviews)->count();
        if ($reviewsPending > 0) {
            $tasks['reviews_pending'] = $reviewsPending;
            $tasks['reviews_overdue'] = (clone $openReviews)->where('due_date', '<', now()->toDateString())->count();
        }

        if ($user->can('funds.disburse')) {
            $tasks['disbursements_pending'] = DB::table('budget_requests')
                ->where('status', 'approved')
                ->count();

            $tasks['settlements_to_finalize'] = DB::table('budget_settlements')
                ->where('status', 'college_verified')
                ->count();
        }

        if ($user->can('proposals.submit')) {
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

    /** The academic year's money, counted the same way as the annual report. */
    private function budgetUtilizationSummary(): array
    {
        $year = $this->academicYear();
        $finance = app(AnnualReportService::class)->finance($year);

        return [
            'fiscal_year' => $year,
            'total_allocated' => $finance['allocated'],
            'total_awarded' => $finance['awarded'],
            'total_disbursed' => $finance['disbursed'],
            'total_settled' => $finance['settled'],
        ];
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

    private function proposalTrendChart(User $user): array
    {
        $months = collect(range(11, 0))->map(fn ($ago) => [
            'month' => now()->subMonths($ago)->format('Y-m'),
            'label' => now()->subMonths($ago)->format('M Y'),
        ]);

        $counts = $this->scoped($user)
            ->where('submitted_at', '>=', now()->subMonths(12)->startOfMonth())
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

            // One column per programme, so new programmes appear on the dashboard chart too.
            return ['month' => $m['label']]
                + collect(Programmes::keys())->mapWithKeys(fn ($key) => [$key => $d->where('category', $key)->sum('count')])->all()
                + ['total' => $d->sum('count')];
        })->values()->toArray();
    }
}
