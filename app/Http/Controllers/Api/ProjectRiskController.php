<?php

namespace App\Http\Controllers\Api;

use App\Exports\ProjectsAtRiskExport;
use App\Exports\ProjectsAtRiskProjectsSheet;
use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\ProgressReportService;
use App\Services\ProjectRiskService;
use App\Support\PdfAssets;
use App\Support\Terms;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;

/**
 * Projects at risk: running funded projects ranked by how much attention they need,
 * with the reasons. Same access and college/category scope as Ongoing Proposals.
 */
class ProjectRiskController extends Controller
{
    public function __construct(private ProjectRiskService $risks) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('monitoring.ongoing')) {
            return $this->forbidden();
        }

        $projects = $this->risks->assess($this->scopedQuery($request));

        return response()->json([
            'data' => [
                'summary' => $this->risks->summary($projects),
                'projects' => $projects,
                'colleges' => $this->colleges($request),
                'college_scoped' => (bool) $request->_college_scope,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * One project's health, for its own page: the research team sees their warnings,
     * and so does anyone who monitors projects in that college and category.
     */
    public function health(Request $request, string $id, ProgressReportService $access): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user = $request->user();

        $monitors = $user->can('monitoring.ongoing') && $user->accessScope()->covers($proposal->college_id, $proposal->category);
        if (! $access->isTeamMember($proposal, $user) && ! $access->canReview($proposal, $user) && ! $monitors) {
            return $this->forbidden();
        }

        return response()->json(['data' => $this->risks->forProposal($proposal), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /** The list as filtered on the page, as an Excel workbook, a CSV file or a PDF report. */
    public function export(Request $request): Response|JsonResponse
    {
        if (! $request->user()?->can('monitoring.ongoing')) {
            return $this->forbidden();
        }

        $filters = $request->validate([
            'format' => 'required|in:xlsx,csv,pdf',
            'level' => 'nullable|in:high,watch,on_track',
            'signal' => 'nullable|in:'.implode(',', array_keys(ProjectRiskService::SIGNAL_LABELS)),
            'search' => 'nullable|string|max:200',
        ]);

        $projects = $this->risks->filter(
            $this->risks->assess($this->scopedQuery($request)),
            $filters['level'] ?? null,
            $filters['signal'] ?? null,
            $filters['search'] ?? null,
        );
        $scope = $this->scopeLines($request, $filters);
        $file = 'projects-at-risk-'.now()->format('Y-m-d');

        return match ($filters['format']) {
            'xlsx' => Excel::download(new ProjectsAtRiskExport($projects, $this->risks->summary($projects), $scope), "{$file}.xlsx"),
            'csv' => Excel::download(new ProjectsAtRiskProjectsSheet($projects, forCsv: true), "{$file}.csv", ExcelFormat::CSV),
            'pdf' => $this->pdf($projects, $scope, "{$file}.pdf"),
        };
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $projects
     * @param  list<string>  $scope
     */
    private function pdf(Collection $projects, array $scope, string $file): Response
    {
        $settings = DB::table('app_settings')->whereIn('key', ['organization_name', 'system_name', 'system_logo'])->pluck('value', 'key');

        return Pdf::loadView('pdf.projects-at-risk', [
            'projects' => $projects,
            'summary' => $this->risks->summary($projects),
            'scope' => $scope,
            'signalLabels' => ProjectRiskService::SIGNAL_LABELS,
            'levelLabels' => ProjectRiskService::LEVEL_LABELS,
            'orgName' => $settings['organization_name'] ?? 'Wolaita Sodo University',
            'systemName' => $settings['system_name'] ?? 'RTT Platform',
            'logo' => PdfAssets::embeddedImage($settings['system_logo'] ?? null),
            'generatedAt' => now(),
        ])->setPaper('a4', 'landscape')->download($file);
    }

    /** Running-project query limited to the user's college/category scope and the chosen college/category. */
    /** @return Builder<Proposal> */
    private function scopedQuery(Request $request): Builder
    {
        $filters = $request->validate([
            'college_id' => 'nullable|string',
            'category' => 'nullable|string|max:50',
        ]);

        $query = Proposal::query()->whereNull('proposals.deleted_at');

        $category = $request->_category_scope ?: ($filters['category'] ?? null);
        if ($category) {
            $query->where('proposals.category', $category);
        }

        $collegeId = $request->_college_scope ?: ($filters['college_id'] ?? null);
        if ($collegeId) {
            $query->where('proposals.college_id', $collegeId);
        }

        return $query;
    }

    private function colleges(Request $request): Collection
    {
        return DB::table('colleges')->where('status', 'active')->orderBy('name')
            ->when($request->_college_scope, fn ($q, $id) => $q->where('id', $id))
            ->get(['id', 'name']);
    }

    /**
     * What the export covers, in words, for its heading.
     *
     * @param  array<string, mixed>  $filters
     * @return list<string>
     */
    private function scopeLines(Request $request, array $filters): array
    {
        $collegeId = $request->_college_scope ?: $request->input('college_id');
        $category = $request->_category_scope ?: $request->input('category');

        return array_values(array_filter([
            Terms::college().': '.($collegeId ? (DB::table('colleges')->where('id', $collegeId)->value('name') ?? '—') : 'All '.strtolower(Terms::college(true))),
            'Category: '.($category ? ucwords(str_replace('_', ' ', $category)) : 'All categories'),
            ! empty($filters['level']) ? 'Level: '.ProjectRiskService::LEVEL_LABELS[$filters['level']] : null,
            ! empty($filters['signal']) ? 'Warning: '.ProjectRiskService::SIGNAL_LABELS[$filters['signal']] : null,
            ! empty($filters['search']) ? 'Search: "'.$filters['search'].'"' : null,
        ]));
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
    }
}
