<?php

namespace App\Http\Controllers\Api;

use App\Exports\ProposalsExport;
use App\Exports\ReportSnapshotExport;
use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ReportSnapshot;
use App\Services\ReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public function __construct(private ReportService $service) {}

    public function index(Request $request): JsonResponse
    {
        $snapshots = ReportSnapshot::where('requested_by', $request->user()->id)
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json(['data' => $snapshots]);
    }

    /** A report's current figures for the chosen year, college and category — no generating step. */
    public function live(Request $request, string $type): JsonResponse
    {
        if (! $request->user()?->can('reports.view_any')) {
            abort(403, 'Unauthorized.');
        }
        if (! in_array($type, ReportService::LIVE_TYPES, true)) {
            abort(404, 'Unknown report.');
        }

        $result = $this->service->live($type, $this->liveFilters($request), $request->boolean('fresh'));

        return response()->json(['data' => $result['rows'], 'message' => '', 'errors' => [], 'meta' => ['generated_at' => $result['generated_at']]]);
    }

    /** The live report, exactly as filtered on screen, as an Excel file. */
    public function liveExport(Request $request, string $type): BinaryFileResponse
    {
        if (! $request->user()?->can('reports.view_any')) {
            abort(403, 'Unauthorized.');
        }
        if (! in_array($type, ReportService::LIVE_TYPES, true)) {
            abort(404, 'Unknown report.');
        }

        [$rows, $fields] = $this->tabulateResult($this->service->live($type, $this->liveFilters($request))['rows']);
        if (empty($rows)) {
            abort(422, 'There is nothing to export for these filters.');
        }

        $columns = collect($fields)->mapWithKeys(fn ($f) => [$f => $this->columnLabel($f)])->all();

        return Excel::download(new ReportSnapshotExport($rows, $columns), $type.'_'.now()->format('Ymd_His').'.xlsx');
    }

    /** Years and colleges the live report filters offer, within the user's scope. */
    public function liveOptions(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user?->can('reports.view_any')) {
            abort(403, 'Unauthorized.');
        }

        $collegeId = $user->accessScope()->isCollege() ? $user->accessScope()->collegeId : null;

        return response()->json(['data' => $this->service->liveFilterOptions($collegeId) + [
            'college_scoped' => (bool) $collegeId,
            'category_scope' => $request->_category_scope,
            'can_save' => $user->can('reports.create'),
        ], 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /**
     * Filters from the query string, with the user's college/category scope enforced
     * over whatever was asked for.
     *
     * @return array<string, string>
     */
    private function liveFilters(Request $request): array
    {
        $filters = $request->validate([
            'academic_year' => 'nullable|string|max:20',
            'college_id' => 'nullable|string|max:64',
            'category' => 'nullable|string|max:50',
        ]);

        $scope = $request->user()->accessScope();
        if ($scope->isCollege()) {
            $filters['college_id'] = $scope->collegeId;
        }
        if ($request->_category_scope) {
            $filters['category'] = $request->_category_scope;
        }

        return array_filter($filters);
    }

    /** Whitelisted subjects/dimensions/metrics the report builder UI can offer. */
    public function builderOptions(Request $request): JsonResponse
    {
        if (! $request->user()?->can('reports.create')) {
            abort(403, 'Unauthorized.');
        }

        return response()->json(['data' => $this->service->builderOptions(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function generate(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('reports.create')) {
            abort(403, 'Unauthorized.');
        }

        $request->validate(['type' => 'required|string']);

        $filters = $request->input('filters', []);

        // College officers and RTT managers can only ever generate reports scoped to their own college —
        // override whatever the client sent rather than merely defaulting to it.
        if ($user->accessScope()->isCollege()) {
            $filters['college_id'] = $user->accessScope()->collegeId;
        }

        $snapshot = $this->service->generate($request->type, $filters, $user);

        $status = $snapshot->status === 'processing' ? 202 : 200;

        return response()->json(['data' => $snapshot], $status);
    }

    public function show(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $snapshot = ReportSnapshot::findOrFail($id);

        if ($snapshot->requested_by !== $user?->id && ! $user?->can('reports.view_all_snapshots')) {
            abort(403, 'Unauthorized.');
        }

        return response()->json(['data' => $snapshot]);
    }

    /** Export any ready report snapshot's result as an Excel file — works for every report type. */
    public function exportExcel(string $id, Request $request): BinaryFileResponse
    {
        $user = $request->user();
        $snapshot = ReportSnapshot::findOrFail($id);

        if ($snapshot->requested_by !== $user?->id && ! $user?->can('reports.view_all_snapshots')) {
            abort(403, 'Unauthorized.');
        }

        if ($snapshot->status !== 'ready' || empty($snapshot->result)) {
            abort(422, 'This report has no data to export yet.');
        }

        [$rows, $fields] = $this->tabulateResult($snapshot->result);

        if (empty($rows)) {
            abort(422, 'This report type cannot be exported to Excel.');
        }

        $columns = collect($fields)->mapWithKeys(fn ($f) => [$f => $this->columnLabel($f)])->all();
        $filename = $snapshot->report_type.'_'.now()->format('Ymd_His').'.xlsx';

        return Excel::download(new ReportSnapshotExport($rows, $columns), $filename);
    }

    /**
     * Normalize any report result shape into a flat [rows, fieldNames] pair.
     * Handles the report-builder's {dimensions, metrics, rows} shape as well as the
     * plain list-of-rows shape every other report type returns.
     *
     * @return array{0: array<int, array<string, mixed>>, 1: string[]}
     */
    private function tabulateResult(array $result): array
    {
        if (isset($result['rows']) && is_array($result['rows'])) {
            $fields = array_merge($result['dimensions'] ?? [], $result['metrics'] ?? []);

            return [$result['rows'], $fields];
        }

        if (array_is_list($result) && ! empty($result) && is_array($result[0])) {
            // Ids are there for drill-down on screen, not for the spreadsheet.
            return [$result, array_values(array_filter(array_keys($result[0]), fn ($f) => ! str_ends_with($f, '_id')))];
        }

        return [[], []];
    }

    private const COLUMN_LABELS = [
        'college' => 'College', 'college_name' => 'College', 'category' => 'Category',
        'status' => 'Status', 'academic_year' => 'Academic Year', 'level' => 'Level',
        'complaint_type' => 'Complaint Type', 'stage' => 'Stage', 'code' => 'Code',
        'count' => 'Count', 'total' => 'Total', 'total_proposals' => 'Total Proposals',
        'total_submitted' => 'Total Submitted', 'total_accepted' => 'Total Accepted',
        'funded' => 'Funded', 'funded_count' => 'Funded', 'rejected' => 'Rejected',
        'rejected_count' => 'Rejected', 'accepted' => 'Accepted',
        'submitted' => 'Submitted', 'validated' => 'Validated', 'under_review' => 'Under Review',
        'archived' => 'Archived', 'unresolved' => 'Unresolved', 'resolved' => 'Resolved',
        'dismissed' => 'Dismissed', 'level_1_college' => 'Level 1 (College)',
        'level_2_officer' => 'Level 2 (Officer)', 'avg_resolution_days' => 'Avg Resolution (days)',
        'approval_rate_percent' => 'Approval Rate (%)', 'rejection_rate_percent' => 'Rejection Rate (%)',
        'pass_rate' => 'Pass Rate (%)', 'reviewer_name' => 'Reviewer', 'total_assigned' => 'Total Assigned',
        'pending' => 'Pending', 'average_days_to_review' => 'Avg Days to Review',
        'submitted_count' => 'Submitted', 'avg_days_to_review' => 'Avg Days to Review',
        'proposal_title' => 'Proposal Title', 'tracker_number' => 'Tracker Number',
        'allocated' => 'Allocated', 'disbursed' => 'Disbursed', 'settled' => 'Settled',
        'utilization_percent' => 'Utilization (%)', 'outputs_produced' => 'Outputs Produced',
        'publications_count' => 'Publications', 'total_awarded' => 'Total Awarded',
        'proposals_submitted' => 'Proposals Submitted', 'proposals_accepted' => 'Proposals Accepted',
        'stage_label' => 'Stage',
    ];

    private function columnLabel(string $key): string
    {
        return self::COLUMN_LABELS[$key] ?? ucwords(str_replace('_', ' ', $key));
    }

    /** Export proposals as an Excel file, filtered by status, college, category, and academic year. */
    public function exportProposals(Request $request): BinaryFileResponse
    {
        $user = $request->user();

        if (! $user?->can('reports.create')) {
            abort(403, 'Unauthorized.');
        }

        $query = Proposal::with(['pi:id,name,email,gender', 'college:id,name', 'department:id,name'])
            ->whereNull('deleted_at');

        if ($user->accessScope()->isCollege()) {
            $query->where('college_id', $user->accessScope()->collegeId);
        }
        if ($request->_category_scope) {
            $query->where('category', $request->_category_scope);
        }

        if ($request->filled('status')) {
            $statuses = array_filter(array_map('trim', explode(',', $request->status)));
            count($statuses) === 1
                ? $query->where('status', $statuses[0])
                : $query->whereIn('status', $statuses);
        }
        if ($request->filled('college_id')) {
            $query->where('college_id', $request->college_id);
        }
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }
        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }
        if ($request->filled('search')) {
            $term = '%'.$request->search.'%';
            $query->where(fn ($q) => $q->where('title', 'LIKE', $term)->orWhere('tracker_number', 'LIKE', $term));
        }

        $proposals = $query->orderByDesc('created_at')->get();
        $filename = 'proposals_'.now()->format('Ymd_His').'.xlsx';

        return Excel::download(new ProposalsExport($proposals), $filename);
    }

    /** Generate a PDF statistics report covering breakdowns by college, department, gender, status, and category. */
    public function proposalStatsPdf(Request $request): Response
    {
        $user = $request->user();

        if (! $user?->can('reports.create')) {
            abort(403, 'Unauthorized.');
        }

        // Drafts are never included in PDF reports — exclude at the base level.
        $base = Proposal::query()
            ->whereNull('proposals.deleted_at')
            ->whereNotIn('proposals.status', ['draft']);

        $user->accessScope()->constrain($base, 'proposals', fn ($q) => $q->where('proposals.pi_user_id', $user->id));

        if ($request->filled('college_id')) {
            $base->where('proposals.college_id', $request->college_id);
        }
        if ($request->filled('category')) {
            $base->where('proposals.category', $request->category);
        }
        if ($request->filled('academic_year')) {
            $base->where('proposals.academic_year', $request->academic_year);
        }

        $totals = [
            'submitted' => (clone $base)->count(),
            'funded' => (clone $base)->whereIn('proposals.status', ['funded', 'midterm_evaluation', 'completed', 'archived'])->count(),
            'rejected' => (clone $base)->where('proposals.status', 'rejected')->count(),
            'under_review' => (clone $base)->whereIn('proposals.status', ['under_blind_review', 'under_open_defence', 'accepted'])->count(),
        ];

        $byCollege = (clone $base)
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->selectRaw('colleges.name as college_name, colleges.code,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN ("funded","midterm_evaluation","completed","archived") THEN 1 ELSE 0 END) as funded,
                         SUM(CASE WHEN proposals.status = "rejected" THEN 1 ELSE 0 END) as rejected,
                         SUM(CASE WHEN proposals.status NOT IN ("draft","rejected","archived") THEN 1 ELSE 0 END) as active')
            ->groupBy('colleges.id', 'colleges.name', 'colleges.code')
            ->orderByDesc('total')
            ->get();

        $byDepartment = (clone $base)
            ->join('departments', 'proposals.department_id', '=', 'departments.id')
            ->join('colleges', 'departments.college_id', '=', 'colleges.id')
            ->selectRaw('departments.name as department_name, colleges.name as college_name,
                         COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN ("funded","midterm_evaluation","completed","archived") THEN 1 ELSE 0 END) as funded')
            ->groupBy('departments.id', 'departments.name', 'colleges.name')
            ->orderByDesc('total')
            ->limit(15)
            ->get();

        $byGender = (clone $base)
            ->join('users', 'proposals.pi_user_id', '=', 'users.id')
            ->selectRaw('COALESCE(users.gender, "not_specified") as gender, COUNT(*) as total,
                         SUM(CASE WHEN proposals.status IN ("funded","midterm_evaluation","completed","archived") THEN 1 ELSE 0 END) as funded')
            ->groupBy('users.gender')
            ->get();

        $byStatus = (clone $base)
            ->selectRaw('proposals.status as status, COUNT(*) as count')
            ->groupBy('proposals.status')
            ->orderByDesc('count')
            ->get();

        $byCategory = (clone $base)
            ->selectRaw('proposals.category as category, COUNT(*) as total')
            ->groupBy('proposals.category')
            ->orderByDesc('total')
            ->get();

        $orgName = DB::table('app_settings')->where('key', 'organization_name')->value('value') ?? 'Woldia University';
        $academicYear = $request->academic_year ?? DB::table('app_settings')->where('key', 'current_academic_year')->value('value') ?? date('Y').'-'.(date('Y') + 1);

        $pdf = Pdf::loadView('pdf.proposal-stats', compact(
            'totals', 'byCollege', 'byDepartment', 'byGender',
            'byStatus', 'byCategory', 'orgName', 'academicYear'
        ))
            ->setPaper('a4', 'portrait')
            ->setOption('defaultFont', 'DejaVu Sans')
            ->setOption('isHtml5ParserEnabled', true)
            ->setOption('isRemoteEnabled', false);

        $filename = 'Proposal-Statistics-'.$academicYear.'-'.now()->format('Ymd').'.pdf';

        return $pdf->download($filename);
    }
}
