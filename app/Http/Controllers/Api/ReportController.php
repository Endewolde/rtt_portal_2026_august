<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ReportSnapshot;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    /** Stream a CSV export of proposals filtered by status, college, category, and academic year. */
    public function exportProposals(Request $request): StreamedResponse
    {
        $user = $request->user();

        if (! $user?->hasAnyRole(['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer', 'college_officer'])) {
            abort(403, 'Unauthorized.');
        }

        $query = Proposal::with(['pi:id,name,email,gender', 'college:id,name', 'department:id,name'])
            ->whereNull('deleted_at');

        // Scope by role
        if ($user->hasRole('college_officer')) {
            $query->where('college_id', $user->college_id);
        }
        if ($request->_category_scope) {
            $query->where('category', $request->_category_scope);
        }

        // Filters
        if ($request->filled('status')) {
            $statuses = array_filter(array_map('trim', explode(',', $request->status)));
            if (count($statuses) === 1) {
                $query->where('status', $statuses[0]);
            } else {
                $query->whereIn('status', $statuses);
            }
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

        $filename = 'proposals_export_'.now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($proposals) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Tracker Number', 'Title', 'Category', 'Status',
                'PI Name', 'PI Email', 'PI Gender',
                'College', 'Department', 'Academic Year',
                'Budget Total', 'Submitted At', 'Last Updated',
            ]);

            foreach ($proposals as $p) {
                fputcsv($handle, [
                    $p->tracker_number,
                    $p->title,
                    $p->category,
                    $p->status,
                    $p->pi?->name,
                    $p->pi?->email,
                    $p->pi?->gender,
                    $p->college?->name,
                    $p->department?->name,
                    $p->academic_year,
                    $p->budgets_sum_amount ?? $p->budgets()->sum('amount'),
                    $p->created_at?->toDateTimeString(),
                    $p->updated_at?->toDateTimeString(),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
