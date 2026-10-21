<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ReminderCooldownException;
use App\Http\Controllers\Controller;
use App\Models\ReviewAssignment;
use App\Services\ReviewReminderService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Overdue/upcoming review dashboard for admins and college officers (each scoped to
 * their own college via the college.scope middleware) — lets them see who's late and
 * nudge them, individually or in bulk, without digging through individual proposals.
 * Manual "Remind" clicks and the daily scheduled reminders (rtt:review-deadline-reminders)
 * both go through ReviewReminderService::sendReminder(), so this page's reminder
 * history always reflects exactly what was sent, however it was triggered.
 */
class ReviewDeadlineController extends Controller
{
    private const MAX_BULK_IDS = 100;

    private const SORTABLE_COLUMNS = [
        'reviewer' => 'deadline_reviewer.name',
        'proposal' => 'proposals.tracker_number',
        'due_date' => 'review_assignments.due_date',
    ];

    public function __construct(private ReviewReminderService $reminders) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('review_deadlines.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $query = $this->applyFilters($this->filteredQuery(), $request, includeStatus: true)
            ->select('review_assignments.*')
            ->with([
                'proposal:id,tracker_number,title,college_id,category',
                'proposal.college:id,name',
                'reviewer:id,name,email',
                'evaluationType:id,name,label',
                'reminders' => fn ($q) => $q->latest('sent_at')->limit(5),
            ]);

        $this->applySort($query, $request);

        $assignments = $query->paginate($request->integer('per_page', 20));

        // Counts always reflect the college/category/type/search filters but NOT the
        // status filter itself (that's exactly what these three counts break down),
        // matching ProposalPipelineController's stage_counts precedent. A fresh
        // filteredQuery() (no inherited select) avoids mixing this aggregate SELECT
        // with non-aggregated columns, which MySQL's ONLY_FULL_GROUP_BY forbids.
        $today = now()->toDateString();
        $weekAhead = now()->addDays(7)->toDateString();
        $counts = $this->applyFilters($this->filteredQuery(), $request, includeStatus: false)
            ->selectRaw(
                'SUM(CASE WHEN review_assignments.due_date < ? THEN 1 ELSE 0 END) as overdue,
                 SUM(CASE WHEN review_assignments.due_date = ? THEN 1 ELSE 0 END) as due_today,
                 SUM(CASE WHEN review_assignments.due_date > ? AND review_assignments.due_date <= ? THEN 1 ELSE 0 END) as due_this_week',
                [$today, $today, $today, $weekAhead]
            )
            ->toBase()->first();

        $collegesQuery = DB::table('colleges')->where('status', 'active')->select('id', 'name')->orderBy('name');
        if ($request->_college_scope) {
            $collegesQuery->where('id', $request->_college_scope);
        }

        return response()->json([
            'data' => [
                'assignments' => $assignments,
                'colleges' => $collegesQuery->get(),
                'counts' => [
                    'overdue' => (int) ($counts->overdue ?? 0),
                    'due_today' => (int) ($counts->due_today ?? 0),
                    'due_this_week' => (int) ($counts->due_this_week ?? 0),
                ],
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function remind(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('review_deadlines.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        // Must include tracker_number/title, not just id/college_id — sendReminder()
        // reads them off this same already-loaded relation, so a narrower select here
        // silently renders empty in the reminder email/notification instead of erroring.
        $assignment = ReviewAssignment::with('proposal:id,college_id,tracker_number,title')->findOrFail($id);

        if (! $this->inScope($assignment, $request)) {
            return response()->json(['data' => null, 'message' => 'This assignment is outside your college.', 'errors' => []], 403);
        }

        try {
            $this->reminders->sendReminder($assignment, 'manual', $user);
        } catch (ReminderCooldownException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => []], 422);
        }

        return response()->json(['data' => null, 'message' => 'Reminder sent.', 'errors' => [], 'meta' => []]);
    }

    /**
     * Remind every reviewer in one batch (e.g. "select all overdue"). Unlike remind(),
     * a single assignment hitting its cooldown or falling outside the caller's college
     * scope is reported per-item rather than failing the whole batch — one stale
     * checkbox shouldn't block reminding everyone else that was selected.
     */
    public function bulkRemind(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('review_deadlines.manage')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:'.self::MAX_BULK_IDS],
            'ids.*' => ['string'],
        ]);

        $assignments = ReviewAssignment::with('proposal:id,college_id,tracker_number,title')
            ->whereIn('id', $validated['ids'])
            ->get();

        $sent = 0;
        $skipped = 0;
        $outOfScope = 0;

        foreach ($assignments as $assignment) {
            if (! $this->inScope($assignment, $request)) {
                $outOfScope++;

                continue;
            }

            try {
                $this->reminders->sendReminder($assignment, 'manual', $user);
                $sent++;
            } catch (ReminderCooldownException) {
                $skipped++;
            }
        }

        return response()->json([
            'data' => [
                'sent' => $sent,
                'skipped' => $skipped,
                'out_of_scope' => $outOfScope,
                'not_found' => count($validated['ids']) - $assignments->count(),
            ],
            'message' => "Sent {$sent} reminder(s).",
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** College officers may only act on assignments whose proposal belongs to their own college. */
    private function inScope(ReviewAssignment $assignment, Request $request): bool
    {
        return ! $request->_college_scope || $assignment->proposal?->college_id === $request->_college_scope;
    }

    /**
     * Every column here MUST be qualified — applySort() joins `users`/`proposals`, which
     * have their own `deleted_at` columns (see ProposalPipelineController for the exact
     * ambiguous-column bug this guards against). Deliberately has no select() of its own —
     * callers add exactly the select they need (row select for the list, aggregate select
     * for the counts) so the two never collide.
     */
    private function filteredQuery(): Builder
    {
        return ReviewAssignment::query()
            ->join('proposals', 'proposals.id', '=', 'review_assignments.proposal_id')
            ->whereIn('review_assignments.status', ReviewReminderService::ACTIVE_STATUSES)
            ->whereNotNull('review_assignments.due_date')
            ->whereNull('proposals.deleted_at');
    }

    private function applyFilters(Builder $query, Request $request, bool $includeStatus): Builder
    {
        $today = now()->toDateString();

        if ($includeStatus && $request->filled('status')) {
            match ($request->status) {
                'overdue' => $query->where('review_assignments.due_date', '<', $today),
                'due_today' => $query->where('review_assignments.due_date', '=', $today),
                'upcoming' => $query->where('review_assignments.due_date', '>', $today),
                default => null,
            };
        }

        if ($request->filled('evaluation_type_id')) {
            $query->where('review_assignments.evaluation_type_id', $request->evaluation_type_id);
        }

        // A college officer's scope always wins over a client-supplied college_id —
        // it can only narrow their own college further, never widen it (same
        // convention as ProposalPipelineController::scopedBaseQuery()).
        if ($request->_college_scope) {
            $query->where('proposals.college_id', $request->_college_scope);
        } elseif ($request->filled('college_id')) {
            $query->where('proposals.college_id', $request->college_id);
        }

        if ($request->filled('category')) {
            $query->where('proposals.category', $request->category);
        }

        if ($request->filled('q')) {
            $term = '%'.$request->q.'%';
            $query->where(fn ($q) => $q
                ->where('proposals.tracker_number', 'like', $term)
                ->orWhere('proposals.title', 'like', $term)
                ->orWhereHas('reviewer', fn ($r) => $r->where('name', 'like', $term)));
        }

        return $query;
    }

    private function applySort(Builder $query, Request $request): void
    {
        $sortKey = $request->get('sort', 'due_date');
        $direction = $request->get('direction') === 'desc' ? 'desc' : 'asc';

        if (! array_key_exists($sortKey, self::SORTABLE_COLUMNS)) {
            $sortKey = 'due_date';
        }

        if ($sortKey === 'reviewer') {
            $query->leftJoin('users as deadline_reviewer', 'review_assignments.reviewer_id', '=', 'deadline_reviewer.id');
        }

        $query->orderBy(self::SORTABLE_COLUMNS[$sortKey], $direction);

        if ($sortKey !== 'due_date') {
            $query->orderBy('review_assignments.due_date', 'asc');
        }
    }
}
