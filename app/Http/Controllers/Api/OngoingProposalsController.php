<?php

namespace App\Http\Controllers\Api;

use App\Exports\OngoingProposalsExport;
use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ThresholdSetting;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Single consolidated view of every proposal that's been funded but not yet closed
 * out (status funded/midterm_evaluation) — a proposal appears here automatically the
 * moment its status becomes funded and drops off once it's completed/archived, no
 * separate "activation" step. Deliberately a hub, not a duplicate action surface: it
 * links into the existing Midterm Evaluation / Completion Workshop pages for the
 * actual scheduling/scoring work rather than reimplementing it here.
 */
class OngoingProposalsController extends Controller
{
    private const ONGOING_STATUSES = ['funded', 'midterm_evaluation'];

    // staff/PI also holds proposals.view_any, so role-array gating (not a bare
    // permission check) is required to keep this admin-monitoring page from them.
    private const ALLOWED_ROLES = [
        'super_admin', 'admin', 'central_officer',
        'research_officer', 'community_officer', 'technology_officer',
        'college_officer',
    ];

    private const SORTABLE_COLUMNS = [
        'tracker' => 'proposals.tracker_number',
        'title' => 'proposals.title',
        'pi' => 'ongoing_pi.name',
        'college' => 'ongoing_college.name',
        'funded_at' => 'ongoing_award.approved_at',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->hasAnyRole(self::ALLOWED_ROLES)) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $base = $this->scopedBaseQuery($request);

        $listQuery = $this->applyListFilters((clone $base), $request)
            ->with([
                'award',
                'pi:id,name',
                'college:id,name',
                'midtermEvaluations' => fn ($q) => $q->latest('evaluation_date'),
                'completionWorkshop',
                'budgetAllocations:id,proposal_id,allocated_amount,remaining_balance',
            ])
            ->select('proposals.*');

        $this->applySort($listQuery, $request);

        $proposals = $listQuery->paginate($request->integer('per_page', 20))
            ->through(fn (Proposal $p) => $this->annotate($p));

        $kpis = $this->computeKpis(clone $base);

        // Chart data — grouped over the full scoped set, not just the current
        // page, so pagination never skews what the charts show.
        $byCollege = (clone $base)
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->selectRaw('colleges.id, colleges.name, COUNT(*) as total')
            ->groupBy('colleges.id', 'colleges.name')
            ->orderByDesc('total')
            ->get();

        $byCategory = (clone $base)
            ->selectRaw('proposals.category, COUNT(*) as total')
            ->groupBy('proposals.category')
            ->pluck('total', 'category');

        $collegesQuery = DB::table('colleges')->where('status', 'active')->select('id', 'name')->orderBy('name');
        if ($request->_college_scope) {
            $collegesQuery->where('id', $request->_college_scope);
        }

        return response()->json([
            'data' => [
                'kpis' => $kpis,
                'by_college' => $byCollege,
                'by_category' => $byCategory,
                'colleges' => $collegesQuery->get(),
                'proposals' => $proposals,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Export the SAME filtered/scoped/sorted list shown in the table (no pagination) as an .xlsx file. */
    public function export(Request $request): BinaryFileResponse
    {
        $user = $request->user();

        if (! $user?->hasAnyRole(self::ALLOWED_ROLES)) {
            abort(403, 'Unauthorized.');
        }

        $listQuery = $this->applyListFilters($this->scopedBaseQuery($request), $request)
            ->with([
                'award',
                'pi:id,name',
                'college:id,name',
                'midtermEvaluations' => fn ($q) => $q->latest('evaluation_date'),
                'completionWorkshop',
                'budgetAllocations:id,proposal_id,allocated_amount,remaining_balance',
            ])
            ->select('proposals.*');

        $this->applySort($listQuery, $request);

        $proposals = $listQuery->get()->map(fn (Proposal $p) => $this->annotate($p));

        $filename = 'ongoing_proposals_'.now()->format('Ymd_His').'.xlsx';

        return Excel::download(new OngoingProposalsExport($proposals), $filename);
    }

    /**
     * Attach the computed fields the frontend needs without extra queries — everything
     * here comes from already-eager-loaded relations.
     */
    private function annotate(Proposal $p): Proposal
    {
        $latestMidterm = $p->midtermEvaluations->first();
        $allocated = (float) $p->budgetAllocations->sum('allocated_amount');
        $remaining = (float) $p->budgetAllocations->sum('remaining_balance');
        $needsMidterm = $p->status === 'funded' && $p->midtermEvaluations->isEmpty();
        $fundedAt = $p->award?->approved_at;

        $p->setAttribute('midterm_status', $latestMidterm?->status);
        $p->setAttribute('midterm_recommendation', $latestMidterm?->recommendation);
        $p->setAttribute('completion_workshop_status', $p->completionWorkshop?->status);
        $p->setAttribute('funded_at', $fundedAt);
        $p->setAttribute('budget_allocated', $allocated);
        $p->setAttribute('budget_utilized', $allocated - $remaining);
        $p->setAttribute('needs_midterm', $needsMidterm);
        $p->setAttribute(
            'needs_completion_workshop',
            $latestMidterm?->status === 'scored' && $latestMidterm?->recommendation === 'continue' && ! $p->completionWorkshop
        );
        $p->setAttribute(
            'is_overdue',
            $needsMidterm && $fundedAt && $fundedAt->diffInDays(now()) > $this->overdueThresholdDays()
        );

        return $p;
    }

    /** Configurable via Settings — Ongoing Proposals — Midterm Overdue After (days), not hardcoded. */
    private function overdueThresholdDays(): int
    {
        return (int) (ThresholdSetting::where('key', 'ongoing_midterm_overdue_days')->value('value') ?? 90);
    }

    private function computeKpis(Builder $base): array
    {
        $awaitingMidterm = (clone $base)
            ->where('proposals.status', 'funded')
            ->whereDoesntHave('midtermEvaluations')
            ->count();

        $overdueCutoff = now()->subDays($this->overdueThresholdDays())->toDateString();
        $overdueAwaitingMidterm = (clone $base)
            ->where('proposals.status', 'funded')
            ->whereDoesntHave('midtermEvaluations')
            ->whereHas('award', fn ($q) => $q->whereDate('approved_at', '<', $overdueCutoff))
            ->count();

        $total = (clone $base)->count();

        $budgetTotals = (clone $base)
            ->join('budget_allocations', 'budget_allocations.proposal_id', '=', 'proposals.id')
            ->selectRaw('COALESCE(SUM(budget_allocations.allocated_amount), 0) as allocated,
                         COALESCE(SUM(budget_allocations.allocated_amount - budget_allocations.remaining_balance), 0) as utilized')
            ->first();

        return [
            'total_ongoing' => $total,
            'awaiting_midterm' => $awaitingMidterm,
            'overdue_awaiting_midterm' => $overdueAwaitingMidterm,
            'in_midterm' => $total - $awaitingMidterm,
            'total_budget_allocated' => (float) ($budgetTotals->allocated ?? 0),
            'total_budget_utilized' => (float) ($budgetTotals->utilized ?? 0),
        ];
    }

    /**
     * Every column here MUST be qualified with `proposals.` — applySort() joins
     * `users`/`colleges`, which also have their own `deleted_at`/`status` columns
     * (same ambiguous-column guard as ProposalPipelineController).
     */
    private function scopedBaseQuery(Request $request): Builder
    {
        $base = Proposal::query()
            ->whereNull('proposals.deleted_at')
            ->whereIn('proposals.status', self::ONGOING_STATUSES);

        if ($request->_category_scope) {
            $base->where('proposals.category', $request->_category_scope);
        } elseif ($request->filled('category')) {
            $base->where('proposals.category', $request->category);
        }

        if ($request->_college_scope) {
            $base->where('proposals.college_id', $request->_college_scope);
        } elseif ($request->filled('college_id')) {
            $base->where('proposals.college_id', $request->college_id);
        }

        return $base;
    }

    private function applyListFilters(Builder $query, Request $request): Builder
    {
        if ($request->filled('status')) {
            $overdueCutoff = now()->subDays($this->overdueThresholdDays())->toDateString();

            match ($request->status) {
                'awaiting_midterm' => $query->where('proposals.status', 'funded')->whereDoesntHave('midtermEvaluations'),
                'in_midterm' => $query->where(fn ($q) => $q
                    ->where('proposals.status', 'midterm_evaluation')
                    ->orWhere(fn ($q2) => $q2->where('proposals.status', 'funded')->whereHas('midtermEvaluations'))),
                'overdue' => $query->where('proposals.status', 'funded')
                    ->whereDoesntHave('midtermEvaluations')
                    ->whereHas('award', fn ($q) => $q->whereDate('approved_at', '<', $overdueCutoff)),
                default => null,
            };
        }

        if ($request->filled('q')) {
            $term = '%'.$request->q.'%';
            $query->where(fn ($q) => $q
                ->where('proposals.tracker_number', 'like', $term)
                ->orWhere('proposals.title', 'like', $term)
                ->orWhereHas('pi', fn ($p) => $p->where('name', 'like', $term)));
        }

        return $query;
    }

    private function applySort(Builder $query, Request $request): void
    {
        $sortKey = $request->get('sort', 'funded_at');
        $direction = $request->get('direction') === 'asc' ? 'asc' : 'desc';

        if (! array_key_exists($sortKey, self::SORTABLE_COLUMNS)) {
            $sortKey = 'funded_at';
        }

        if ($sortKey === 'pi') {
            $query->leftJoin('users as ongoing_pi', 'proposals.pi_user_id', '=', 'ongoing_pi.id');
        } elseif ($sortKey === 'college') {
            $query->leftJoin('colleges as ongoing_college', 'proposals.college_id', '=', 'ongoing_college.id');
        } elseif ($sortKey === 'funded_at') {
            $query->leftJoin('awards as ongoing_award', 'proposals.id', '=', 'ongoing_award.proposal_id');
        }

        $query->orderBy(self::SORTABLE_COLUMNS[$sortKey], $direction);

        if ($sortKey !== 'funded_at') {
            $query->orderBy('proposals.updated_at', 'desc');
        }
    }
}
