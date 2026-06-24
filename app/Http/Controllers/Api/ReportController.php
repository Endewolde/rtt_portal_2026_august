<?php

namespace App\Http\Controllers\Api;

use App\Exports\ProposalsExport;
use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ReportSnapshot;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
}
