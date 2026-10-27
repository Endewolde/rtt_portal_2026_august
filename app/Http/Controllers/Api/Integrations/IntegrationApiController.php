<?php

namespace App\Http\Controllers\Api\Integrations;

use App\Http\Controllers\Controller;
use App\Models\Award;
use App\Models\Proposal;
use App\Models\ResearchOutput;
use App\Services\ReportService;
use App\Support\Terms;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only data for other systems (HR, finance, ERP, a website). Never includes
 * reviewer identities, review scores or comments.
 */
class IntegrationApiController extends Controller
{
    public function proposals(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => 'nullable|string|max:40',
            'academic_year' => 'nullable|string|max:20',
            'category' => 'nullable|string|max:50',
            'updated_since' => 'nullable|date',
            'per_page' => 'nullable|integer|min:1|max:200',
        ]);

        $page = Proposal::with(['college:id,name', 'department:id,name', 'pi:id,name', 'award:id,proposal_id,grant_reference,awarded_amount,approved_at'])
            ->whereNull('deleted_at')->where('status', '!=', 'draft')
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['academic_year'] ?? null, fn ($q, $y) => $q->where('academic_year', $y))
            ->when($filters['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->when($filters['updated_since'] ?? null, fn ($q, $d) => $q->where('updated_at', '>=', $d))
            ->orderByDesc('updated_at')
            ->paginate($filters['per_page'] ?? 50);

        return response()->json([
            'data' => collect($page->items())->map(fn ($p) => $this->present($p))->values(),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function proposal(string $tracker): JsonResponse
    {
        $p = Proposal::with(['college:id,name', 'department:id,name', 'pi:id,name', 'award'])
            ->whereNull('deleted_at')->where('status', '!=', 'draft')->where('tracker_number', $tracker)->firstOrFail();

        return response()->json(['data' => $this->present($p)]);
    }

    /** @return array<string, mixed> */
    private function present(Proposal $p): array
    {
        return [
            'id' => $p->id,
            'tracker_number' => $p->tracker_number,
            'title' => $p->title,
            'category' => $p->category,
            'status' => $p->status,
            'academic_year' => $p->academic_year,
            'college' => $p->college?->name,
            'department' => $p->department?->name,
            'principal_investigator' => $p->pi?->name,
            'duration_months' => $p->duration_months,
            'sdgs' => $p->sdgs ?? [],
            'submitted_at' => $p->submitted_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
            'award' => $p->award ? [
                'grant_reference' => $p->award->grant_reference,
                'amount' => (float) $p->award->awarded_amount,
                'currency' => Terms::currency(),
                'approved_at' => $p->award->approved_at?->toIso8601String(),
            ] : null,
        ];
    }

    public function awards(Request $request): JsonResponse
    {
        $filters = $request->validate(['since' => 'nullable|date', 'per_page' => 'nullable|integer|min:1|max:200']);

        $page = Award::with('proposal:id,tracker_number,title,category,academic_year,college_id')
            ->when($filters['since'] ?? null, fn ($q, $d) => $q->where('approved_at', '>=', $d))
            ->orderByDesc('approved_at')
            ->paginate($filters['per_page'] ?? 50);

        return response()->json([
            'data' => collect($page->items())->map(fn (Award $a) => [
                'id' => $a->id,
                'grant_reference' => $a->grant_reference,
                'amount' => (float) $a->awarded_amount,
                'currency' => Terms::currency(),
                'approved_at' => $a->approved_at?->toIso8601String(),
                'proposal' => $a->proposal?->only(['tracker_number', 'title', 'category', 'academic_year']),
            ])->values(),
            'meta' => ['page' => $page->currentPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function outputs(Request $request): JsonResponse
    {
        $filters = $request->validate(['type' => 'nullable|string|max:40', 'since' => 'nullable|date', 'per_page' => 'nullable|integer|min:1|max:200']);

        $page = ResearchOutput::with('proposal:id,tracker_number,title')
            ->when($filters['type'] ?? null, fn ($q, $t) => $q->where('output_type', $t))
            ->when($filters['since'] ?? null, fn ($q, $d) => $q->where('created_at', '>=', $d))
            ->latest()
            ->paginate($filters['per_page'] ?? 50);

        return response()->json([
            'data' => collect($page->items())->map(fn (ResearchOutput $o) => [
                'id' => $o->id,
                'type' => $o->output_type,
                'title' => $o->title,
                'status' => $o->status,
                'proposal' => $o->proposal?->only(['tracker_number', 'title']),
                'created_at' => $o->created_at?->toIso8601String(),
            ])->values(),
            'meta' => ['page' => $page->currentPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function report(Request $request, string $type, ReportService $reports): JsonResponse
    {
        if (! in_array($type, ReportService::LIVE_TYPES, true)) {
            return response()->json(['message' => 'Unknown report.', 'reports' => ReportService::LIVE_TYPES], 404);
        }

        $filters = $request->validate(['academic_year' => 'nullable|string|max:20', 'college_id' => 'nullable|string|max:64', 'category' => 'nullable|string|max:50']);
        $result = $reports->live($type, array_filter($filters));

        return response()->json(['data' => $result['rows'], 'meta' => ['report' => $type, 'generated_at' => $result['generated_at']]]);
    }
}
