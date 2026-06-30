<?php

namespace App\Http\Controllers\Api;

use App\Exports\ProposalsExport;
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

    public function generate(Request $request): JsonResponse
    {
        $request->validate(['type' => 'required|string']);

        $snapshot = $this->service->generate(
            $request->type,
            $request->input('filters', []),
            $request->user()
        );

        $status = $snapshot->status === 'processing' ? 202 : 200;

        return response()->json(['data' => $snapshot], $status);
    }

    public function show(string $id): JsonResponse
    {
        $snapshot = ReportSnapshot::findOrFail($id);

        return response()->json(['data' => $snapshot]);
    }

    /** Export proposals as an Excel file, filtered by status, college, category, and academic year. */
    public function exportProposals(Request $request): BinaryFileResponse
    {
        $user = $request->user();

        if (! $user?->hasAnyRole(['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer', 'college_officer'])) {
            abort(403, 'Unauthorized.');
        }

        $query = Proposal::with(['pi:id,name,email,gender', 'college:id,name', 'department:id,name'])
            ->whereNull('deleted_at');

        if ($user->hasRole('college_officer')) {
            $query->where('college_id', $user->college_id);
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

        $proposals = $query->orderByDesc('created_at')->get();
        $filename = 'proposals_'.now()->format('Ymd_His').'.xlsx';

        return Excel::download(new ProposalsExport($proposals), $filename);
    }

    /** Generate a PDF statistics report covering breakdowns by college, department, gender, status, and category. */
    public function proposalStatsPdf(Request $request): Response
    {
        $user = $request->user();

        if (! $user?->hasAnyRole(['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer', 'college_officer'])) {
            abort(403, 'Unauthorized.');
        }

        // Drafts are never included in PDF reports — exclude at the base level.
        $base = Proposal::query()
            ->whereNull('proposals.deleted_at')
            ->whereNotIn('proposals.status', ['draft']);

        if ($user->hasRole('college_officer')) {
            $base->where('proposals.college_id', $user->college_id);
        }

        $categoryMap = [
            'research_officer' => 'research',
            'community_officer' => 'community_engagement',
            'technology_officer' => 'technology_transfer',
        ];
        foreach ($categoryMap as $role => $category) {
            if ($user->hasRole($role)) {
                $base->where('proposals.category', $category);
                break;
            }
        }

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
