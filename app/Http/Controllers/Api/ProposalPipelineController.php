<?php

namespace App\Http\Controllers\Api;

use App\Exports\ProposalsExport;
use App\Http\Controllers\Controller;
use App\Models\Proposal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProposalPipelineController extends Controller
{
    /** sort key (client-facing) => real column, qualified where a join is involved. */
    private const SORTABLE_COLUMNS = [
        'tracker' => 'proposals.tracker_number',
        'title' => 'proposals.title',
        'category' => 'proposals.category',
        'status' => 'proposals.status',
        'date' => 'proposals.submitted_at',
        'updated_at' => 'proposals.updated_at',
        'pi' => 'pipeline_pi.name',
        'college' => 'pipeline_college.name',
    ];

    /**
     * Cross-phase status overview for an academic year: how many proposals currently
     * sit in each workflow stage, plus a filterable/searchable/sortable proposal list.
     * College and category officers are always scoped to their own college/category via
     * the college.scope / category.scope middleware (_college_scope / _category_scope) —
     * client-supplied college_id/category filters can only narrow further, never widen.
     * Drafts are never submitted proposals — excluded everywhere (counts, list, export).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('pipeline.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $academicYear = $this->resolveAcademicYear($request);
        $base = $this->scopedBaseQuery($request, $academicYear);

        // Stage counts always reflect the year/college/category filters but NOT the
        // status filter itself, so the pipeline breakdown stays complete even while
        // the table below is narrowed to a single stage.
        $stageCounts = (clone $base)
            ->select('proposals.status', DB::raw('count(*) as count'))
            ->groupBy('proposals.status')
            ->pluck('count', 'status');

        $listQuery = $this->applyListFilters((clone $base), $request)
            ->with(['pi:id,name,email', 'college:id,name']);

        $this->applySort($listQuery, $request);

        $proposals = $listQuery->paginate($request->integer('per_page', 20));

        $academicYears = Proposal::whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->where('status', '!=', 'draft')
            ->distinct()
            ->orderByDesc('academic_year')
            ->pluck('academic_year');

        $collegesQuery = DB::table('colleges')->where('status', 'active')->select('id', 'name')->orderBy('name');
        if ($request->_college_scope) {
            $collegesQuery->where('id', $request->_college_scope);
        }

        return response()->json([
            'data' => [
                'academic_year' => $academicYear,
                'academic_years' => $academicYears,
                'colleges' => $collegesQuery->get(),
                'stage_counts' => $stageCounts,
                'total' => (clone $base)->count(),
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

        if (! $user?->can('pipeline.view')) {
            abort(403, 'Unauthorized.');
        }

        $academicYear = $this->resolveAcademicYear($request);
        $base = $this->scopedBaseQuery($request, $academicYear);

        $listQuery = $this->applyListFilters($base, $request)
            ->with(['pi:id,name,email,gender', 'college:id,name', 'department:id,name']);

        $this->applySort($listQuery, $request);

        $filename = 'proposal_pipeline_'.($academicYear ?: 'all').'_'.now()->format('Ymd_His').'.xlsx';

        return Excel::download(new ProposalsExport($listQuery->get()), $filename);
    }

    private function resolveAcademicYear(Request $request): ?string
    {
        return $request->filled('academic_year')
            ? $request->academic_year
            : (DB::table('app_settings')->where('key', 'current_academic_year')->value('value') ?? null);
    }

    /**
     * Year + college + category scoping, and excluding drafts (never a "submitted"
     * proposal, so it has no place in a pipeline built to track submitted work) — shared
     * by the stage counts, the listing, and the export so they can never disagree.
     */
    private function scopedBaseQuery(Request $request, ?string $academicYear): Builder
    {
        // Every column here MUST be qualified with `proposals.` — applySort() may
        // later join `users`/`colleges`, which also have their own `deleted_at`/
        // `status` columns, and an unqualified reference would become ambiguous.
        $base = Proposal::query()->whereNull('proposals.deleted_at')->where('proposals.status', '!=', 'draft');

        if ($academicYear) {
            $base->where('proposals.academic_year', $academicYear);
        }

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

    /** Status + free-text search — applied on top of scopedBaseQuery() for both the list and the export. */
    private function applyListFilters(Builder $query, Request $request): Builder
    {
        if ($request->filled('status')) {
            $query->where('proposals.status', $request->status);
        }

        if ($request->filled('q')) {
            $term = '%'.$request->q.'%';
            $query->where(fn ($q) => $q->where('proposals.tracker_number', 'like', $term)->orWhere('proposals.title', 'like', $term));
        }

        return $query;
    }

    /**
     * Sorting by pi/college requires a join (they live on related tables) — done via a
     * whitelisted column map, never raw client input, and aliased join tables so they
     * never collide with an eager-loaded relation of the same name.
     */
    private function applySort(Builder $query, Request $request): void
    {
        $sortKey = $request->get('sort', 'updated_at');
        $direction = $request->get('direction') === 'asc' ? 'asc' : 'desc';

        if (! array_key_exists($sortKey, self::SORTABLE_COLUMNS)) {
            $sortKey = 'updated_at';
        }

        if ($sortKey === 'pi') {
            $query->leftJoin('users as pipeline_pi', 'proposals.pi_user_id', '=', 'pipeline_pi.id')
                ->select('proposals.*');
        } elseif ($sortKey === 'college') {
            $query->leftJoin('colleges as pipeline_college', 'proposals.college_id', '=', 'pipeline_college.id')
                ->select('proposals.*');
        }

        $query->orderBy(self::SORTABLE_COLUMNS[$sortKey], $direction);

        // Stable tie-break so equal-value rows (e.g. same status) don't jump around
        // between page loads.
        if ($sortKey !== 'updated_at') {
            $query->orderByDesc('proposals.updated_at');
        }
    }
}
