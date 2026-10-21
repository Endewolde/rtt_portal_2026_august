<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Proposal;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Services\RepositoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RepositoryController extends Controller
{
    public function __construct(private RepositoryService $repositoryService) {}

    public function index(Request $request): JsonResponse
    {
        $results = $this->repositoryService->search($request->all());

        return response()->json(['data' => $results], 200);
    }

    public function show(string $id): JsonResponse
    {
        $record = RepositoryRecord::with([
            'college:id,name',
            'proposal.outputs.publication',
            'proposal.outputs.patent',
            'proposal.outputs.conferencePresentation',
            'proposal.outputs.technology',
            'proposal.outputs.communityImpact',
        ])->findOrFail($id);

        return response()->json(['data' => $record], 200);
    }

    public function tracker(string $number): JsonResponse
    {
        try {
            $data = $this->repositoryService->getTrackerStatus($number);

            return response()->json(['data' => $data], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }
    }

    // ─── Admin endpoints ──────────────────────────────────────────────────────

    public function adminIndex(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('repository.manage')) {
            abort(403);
        }

        $query = RepositoryRecord::with(['college:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('q')) {
            $term = '%'.$request->q.'%';
            $query->where(fn ($q) => $q->where('title', 'LIKE', $term)
                ->orWhere('pi_name', 'LIKE', $term)
            );
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('college_id')) {
            $query->where('college_id', $request->college_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json(['data' => $query->paginate(20), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function publishableProposals(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('repository.manage')) {
            abort(403);
        }

        $alreadyPublished = RepositoryRecord::pluck('proposal_id');

        $proposals = Proposal::whereIn('status', ['completed'])
            ->whereNotIn('id', $alreadyPublished)
            ->with(['college:id,name', 'pi:id,name'])
            ->select('id', 'tracker_number', 'title', 'pi_user_id', 'college_id', 'category', 'academic_year', 'status')
            ->orderBy('title')
            ->get();

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function publish(Request $request, string $proposalId): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('repository.manage')) {
            abort(403);
        }

        $proposal = Proposal::with(['college', 'pi'])->findOrFail($proposalId);

        $validated = $request->validate([
            'abstract' => ['nullable', 'string'],
            'keywords' => ['nullable', 'string', 'max:500'],
            'is_featured' => ['nullable', 'boolean'],
        ]);

        $counts = ResearchOutput::where('proposal_id', $proposalId)
            ->selectRaw('
                COUNT(*) as total,
                SUM(output_type IN ("journal_article","conference_paper","book")) as pubs,
                SUM(output_type = "patent") as patents
            ')
            ->first();

        $record = RepositoryRecord::updateOrCreate(
            ['proposal_id' => $proposalId],
            [
                'title' => $proposal->title,
                'abstract' => $validated['abstract'] ?? $proposal->abstract ?? null,
                'keywords' => $validated['keywords'] ?? null,
                'category' => $proposal->category,
                'college_id' => $proposal->college_id,
                'pi_name' => $proposal->pi?->name ?? 'Unknown',
                'academic_year' => $proposal->academic_year,
                'status' => 'published',
                'total_outputs' => (int) ($counts->total ?? 0),
                'publications_count' => (int) ($counts->pubs ?? 0),
                'patents_count' => (int) ($counts->patents ?? 0),
                'is_featured' => $validated['is_featured'] ?? false,
            ]
        );

        $record->load('college:id,name');

        return response()->json(['data' => $record, 'message' => 'Research published to repository.', 'errors' => [], 'meta' => []], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('repository.manage')) {
            abort(403);
        }

        $record = RepositoryRecord::findOrFail($id);
        $validated = $request->validate([
            'abstract' => ['nullable', 'string'],
            'keywords' => ['nullable', 'string', 'max:500'],
            'is_featured' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:published,archived'],
        ]);

        $record->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json(['data' => $record, 'message' => 'Repository record updated.', 'errors' => [], 'meta' => []]);
    }

    public function unpublish(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('repository.manage')) {
            abort(403);
        }

        $record = RepositoryRecord::findOrFail($id);
        $record->update(['status' => 'archived']);

        return response()->json(['data' => $record, 'message' => 'Record removed from public repository.', 'errors' => [], 'meta' => []]);
    }

    public function adminStats(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->can('repository.manage')) {
            abort(403);
        }

        $stats = [
            'total_published' => RepositoryRecord::where('status', 'published')->count(),
            'total_archived' => RepositoryRecord::where('status', 'archived')->count(),
            'featured_count' => RepositoryRecord::where('is_featured', true)->count(),
            'publishable' => Proposal::where('status', 'completed')
                ->whereNotIn('id', RepositoryRecord::pluck('proposal_id'))
                ->count(),
            'total_outputs' => ResearchOutput::count(),
            'colleges' => College::withCount(['repositoryRecords' => fn ($q) => $q->where('status', 'published')])
                ->having('repository_records_count', '>', 0)
                ->orderByDesc('repository_records_count')
                ->get(['id', 'name']),
        ];

        return response()->json(['data' => $stats, 'message' => '', 'errors' => [], 'meta' => []]);
    }
}
