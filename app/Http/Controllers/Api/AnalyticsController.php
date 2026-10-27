<?php

namespace App\Http\Controllers\Api;

use App\Exports\CallOutcomesExport;
use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use App\Support\Programmes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AnalyticsController extends Controller
{
    /** Sent as academic_year to see every year; leaving it out means the current year. */
    private const ALL_YEARS = 'all';

    public function __construct(private AnalyticsService $analytics) {}

    /**
     * Full analytics payload in one request. College officers are always limited to their
     * own college and category directors to their own category, whatever the client sends.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('analytics.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $currentYear = DB::table('app_settings')->where('key', 'current_academic_year')->value('value');
        $filters = $this->filters($request, $currentYear);

        return response()->json([
            'data' => [
                'filters' => $filters + [
                    'current_academic_year' => $currentYear,
                    'college_locked' => $user->accessScope()->isCollege(),
                    'category_locked' => (bool) $request->_category_scope,
                ],
                'academicYears' => DB::table('proposals')->whereNull('deleted_at')->whereNotNull('academic_year')
                    ->distinct()->orderByDesc('academic_year')->pluck('academic_year'),
                'college_options' => DB::table('colleges')->whereNull('deleted_at')->where('status', 'active')
                    ->orderBy('name')->get(['id', 'name', 'code']),
                'call_options' => DB::table('proposal_calls')
                    ->when($filters['academic_year'], fn ($q, $year) => $q->where('academic_year', $year))
                    ->when($filters['category'], fn ($q, $category) => $q->where('category', $category))
                    ->whereExists(fn ($q) => $q->from('proposals')->whereColumn('proposals.proposal_call_id', 'proposal_calls.id')
                        ->whereNull('proposals.deleted_at')->where('proposals.status', '!=', 'draft'))
                    ->orderByDesc('academic_year')->orderBy('title')
                    ->get(['id', 'title', 'academic_year', 'category']),
                'calls' => $this->analytics->calls($filters),
                ...$this->analytics->dashboard($filters),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** The call comparison as an Excel file, with the same filters as the page. */
    public function exportCalls(Request $request): BinaryFileResponse|JsonResponse
    {
        if (! $request->user()?->can('analytics.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $filters = $this->filters($request, DB::table('app_settings')->where('key', 'current_academic_year')->value('value'));
        $scope = collect([
            $filters['academic_year'] ?? 'All years',
            $filters['college_id'] ? DB::table('colleges')->where('id', $filters['college_id'])->value('name') : 'All colleges',
            $filters['category'] ? ucwords(str_replace('_', ' ', $filters['category'])) : 'All categories',
        ])->implode(' · ');

        return Excel::download(
            new CallOutcomesExport($this->analytics->calls($filters), $scope),
            'call_outcomes_'.now()->format('Ymd_His').'.xlsx'
        );
    }

    /**
     * Filters from the request. College officers are always limited to their own
     * college and category directors to their own category, whatever the client sends.
     *
     * @return array{academic_year: string|null, college_id: string|null, category: string|null, proposal_call_id: string|null}
     */
    private function filters(Request $request, ?string $currentYear): array
    {
        $user = $request->user();
        $requestedYear = $request->input('academic_year');
        $category = $request->_category_scope ?: (in_array($request->input('category'), Programmes::keys(), true) ? $request->input('category') : null);
        $callId = $request->input('proposal_call_id');

        return [
            'academic_year' => $requestedYear === self::ALL_YEARS ? null : ($requestedYear ?: $currentYear),
            'college_id' => $user->accessScope()->isCollege() ? $user->accessScope()->collegeId : ($request->input('college_id') ?: null),
            'category' => $category,
            'proposal_call_id' => is_string($callId) && DB::table('proposal_calls')->where('id', $callId)->exists() ? $callId : null,
        ];
    }
}
