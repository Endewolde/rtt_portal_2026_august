<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Models\User;
use App\Services\ResearchOutputService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResearchOutputController extends Controller
{
    public function __construct(private ResearchOutputService $outputService) {}

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = ResearchOutput::query();

        $this->scopeToUser($query, $user);

        $totals = (clone $query)->selectRaw('
            COUNT(*) as total,
            SUM(output_type = "journal_article")     as journal_articles,
            SUM(output_type = "conference_paper")    as conference_papers,
            SUM(output_type = "patent")              as patents,
            SUM(output_type = "book")                as books,
            SUM(output_type = "software")            as software,
            SUM(output_type = "prototype")           as prototypes,
            SUM(output_type = "community_impact")    as community_impacts,
            SUM(output_type = "technology_transfer") as technology_transfers
        ')->first();

        return response()->json(['data' => $totals, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function eligibleProposals(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Proposal::whereIn('status', ['funded', 'completed'])
            ->with(['college:id,name'])
            ->select('id', 'tracker_number', 'title', 'college_id', 'status', 'academic_year', 'category');

        if ($user->hasAnyRole(['college_officer'])) {
            $query->where('college_id', $user->college_id);
        } elseif ($user->hasRole('research_officer')) {
            $query->where('category', 'research');
        } elseif ($user->hasRole('community_officer')) {
            $query->where('category', 'community_engagement');
        } elseif ($user->hasRole('technology_officer')) {
            $query->where('category', 'technology_transfer');
        } elseif (! $user->hasAnyRole(['super_admin', 'central_officer'])) {
            $query->where(fn ($q) => $q->where('pi_user_id', $user->id)
                ->orWhereHas('members', fn ($sq) => $sq->where('user_id', $user->id)->where('status', 'active')
                )
            );
        }

        return response()->json(['data' => $query->orderBy('title')->get(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = ResearchOutput::with([
            'proposal:id,tracker_number,title,college_id,academic_year,category',
            'proposal.college:id,name',
            'recordedBy:id,name',
            'verifiedBy:id,name',
            'approvedBy:id,name',
            'publication',
            'patent',
            'conferencePresentation',
            'technology',
            'communityImpact',
        ])->orderByDesc('created_at');

        $this->scopeToUser($query, $user);

        if ($request->filled('proposal_id')) {
            $query->where('proposal_id', $request->proposal_id);
        }

        if ($request->filled('output_type')) {
            $query->where('output_type', $request->output_type);
        }

        return response()->json(['data' => $query->get(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'proposal_id' => ['required', 'uuid', 'exists:proposals,id'],
            'output_type' => ['required', 'in:journal_article,conference_paper,book,patent,software,prototype,community_impact,technology_transfer'],
            'title' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            // Publication (journal_article, book)
            'doi' => ['nullable', 'string', 'max:200'],
            'journal_name' => ['nullable', 'string', 'max:300'],
            'volume' => ['nullable', 'string', 'max:50'],
            'issue' => ['nullable', 'string', 'max:50'],
            'pages' => ['nullable', 'string', 'max:50'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'publisher' => ['nullable', 'string', 'max:300'],
            'is_scopus_indexed' => ['nullable', 'boolean'],
            'is_wos_indexed' => ['nullable', 'boolean'],
            // Patent
            'patent_number' => ['nullable', 'string', 'max:100'],
            'jurisdiction' => ['nullable', 'string', 'max:100'],
            'filing_date' => ['nullable', 'date'],
            'grant_date' => ['nullable', 'date'],
            'patent_status' => ['nullable', 'string', 'max:50'],
            'technical_specs' => ['nullable', 'string'],
            // Conference paper
            'conference_name' => ['nullable', 'string', 'max:300'],
            'location' => ['nullable', 'string', 'max:200'],
            'presentation_date' => ['nullable', 'date'],
            'proceedings_isbn' => ['nullable', 'string', 'max:50'],
            // Technology / software / prototype
            'version' => ['nullable', 'string', 'max:50'],
            'repository_url' => ['nullable', 'url', 'max:500'],
            'license' => ['nullable', 'string', 'max:100'],
            'demo_url' => ['nullable', 'url', 'max:500'],
            // Community impact
            'beneficiary_count' => ['nullable', 'integer', 'min:0'],
            'impact_category' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->user();
        $proposal = Proposal::findOrFail($validated['proposal_id']);

        $this->authorizeProposalAccess($user, $validated['proposal_id']);

        try {
            $output = $this->outputService->record($proposal, $validated['output_type'], $validated, $user);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => [], 'data' => null, 'meta' => []], 422);
        }

        $output->load(['proposal:id,tracker_number,title', 'recordedBy:id,name', 'publication', 'patent', 'conferencePresentation', 'technology', 'communityImpact']);

        return response()->json(['data' => $output, 'message' => 'Research output recorded.', 'errors' => [], 'meta' => []], 201);
    }

    public function show(string $id): JsonResponse
    {
        $output = ResearchOutput::with([
            'proposal:id,tracker_number,title,college_id',
            'proposal.college:id,name',
            'recordedBy:id,name',
            'publication',
            'patent',
            'conferencePresentation',
            'technology',
            'communityImpact',
        ])->findOrFail($id);

        return response()->json(['data' => $output, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $output = ResearchOutput::findOrFail($id);
        $this->authorizeProposalAccess($request->user(), $output->proposal_id);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            // Publication
            'doi' => ['nullable', 'string', 'max:200'],
            'journal_name' => ['nullable', 'string', 'max:300'],
            'volume' => ['nullable', 'string', 'max:50'],
            'issue' => ['nullable', 'string', 'max:50'],
            'pages' => ['nullable', 'string', 'max:50'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'publisher' => ['nullable', 'string', 'max:300'],
            'is_scopus_indexed' => ['nullable', 'boolean'],
            'is_wos_indexed' => ['nullable', 'boolean'],
            // Patent
            'patent_number' => ['nullable', 'string', 'max:100'],
            'jurisdiction' => ['nullable', 'string', 'max:100'],
            'filing_date' => ['nullable', 'date'],
            'grant_date' => ['nullable', 'date'],
            'patent_status' => ['nullable', 'string', 'max:50'],
            'technical_specs' => ['nullable', 'string'],
            // Conference paper
            'conference_name' => ['nullable', 'string', 'max:300'],
            'location' => ['nullable', 'string', 'max:200'],
            'presentation_date' => ['nullable', 'date'],
            'proceedings_isbn' => ['nullable', 'string', 'max:50'],
            // Technology / software / prototype
            'version' => ['nullable', 'string', 'max:50'],
            'repository_url' => ['nullable', 'url', 'max:500'],
            'license' => ['nullable', 'string', 'max:100'],
            'demo_url' => ['nullable', 'url', 'max:500'],
            // Community impact
            'beneficiary_count' => ['nullable', 'integer', 'min:0'],
            'impact_category' => ['nullable', 'string', 'max:100'],
        ]);

        if (isset($validated['title'])) {
            $output->title = $validated['title'];
        }
        $output->description = $validated['description'] ?? $output->description;
        $output->save();

        $output->load(['publication', 'patent', 'conferencePresentation', 'technology', 'communityImpact']);

        return response()->json(['data' => $output, 'message' => 'Output updated.', 'errors' => [], 'meta' => []]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $output = ResearchOutput::findOrFail($id);
        $this->authorizeProposalAccess($request->user(), $output->proposal_id);

        $proposalId = $output->proposal_id;
        $output->delete();
        $this->syncRepositoryRecord($proposalId);

        return response()->json(['data' => null, 'message' => 'Output deleted.', 'errors' => [], 'meta' => []]);
    }

    public function verify(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'college_officer'])) {
            abort(403, 'Only college officers can verify research outputs.');
        }

        $output = ResearchOutput::with(['proposal:id,college_id'])->findOrFail($id);

        if ($user->hasRole('college_officer') && $output->proposal?->college_id !== $user->college_id) {
            abort(403, 'You can only verify outputs from your college.');
        }

        $validated = $request->validate([
            'action' => ['required', 'in:verify,reject'],
            'review_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $isApproved = $validated['action'] === 'verify';

        $output->update([
            'status' => $isApproved ? 'verified' : 'rejected',
            'review_notes' => $validated['review_notes'] ?? null,
            'verified_by' => $isApproved ? $user->id : null,
            'verified_at' => $isApproved ? now() : null,
        ]);

        $output->load(['verifiedBy:id,name', 'approvedBy:id,name', 'recordedBy:id,name']);

        return response()->json([
            'data' => $output,
            'message' => $isApproved ? 'Output verified.' : 'Output rejected.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'])) {
            abort(403, 'Only research officers or admins can approve research outputs.');
        }

        $output = ResearchOutput::with(['proposal:id,category'])->findOrFail($id);

        if ($output->status !== 'verified') {
            return response()->json(['message' => 'Output must be verified before it can be approved.', 'errors' => [], 'data' => null, 'meta' => []], 422);
        }

        $validated = $request->validate([
            'review_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $output->update([
            'status' => 'approved',
            'review_notes' => $validated['review_notes'] ?? $output->review_notes,
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        $output->load(['verifiedBy:id,name', 'approvedBy:id,name', 'recordedBy:id,name']);

        return response()->json([
            'data' => $output,
            'message' => 'Research output approved.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function scopeToUser(Builder $query, User $user): void
    {
        if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
            return;
        }

        if ($user->hasAnyRole(['college_officer'])) {
            $query->whereHas('proposal', fn ($q) => $q->where('college_id', $user->college_id));

            return;
        }

        if ($user->hasRole('research_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'research'));

            return;
        }

        if ($user->hasRole('community_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'community_engagement'));

            return;
        }

        if ($user->hasRole('technology_officer')) {
            $query->whereHas('proposal', fn ($q) => $q->where('category', 'technology_transfer'));

            return;
        }

        $query->where(fn ($q) => $q->where('recorded_by', $user->id)
            ->orWhereHas('proposal', fn ($sq) => $sq->where('pi_user_id', $user->id)
                ->orWhereHas('members', fn ($ssq) => $ssq->where('user_id', $user->id)->where('status', 'active')
                )
            )
        );
    }

    private function authorizeProposalAccess(User $user, string $proposalId): void
    {
        if ($user->hasAnyRole(['super_admin', 'central_officer', 'college_officer', 'research_officer', 'community_officer', 'technology_officer'])) {
            return;
        }

        $proposal = Proposal::findOrFail($proposalId);
        $isMember = $proposal->members()->where('user_id', $user->id)->where('status', 'active')->exists();

        if ($proposal->pi_user_id !== $user->id && ! $isMember) {
            abort(403, 'You are not authorized to record outputs for this proposal.');
        }
    }

    private function syncRepositoryRecord(string $proposalId): void
    {
        $record = RepositoryRecord::where('proposal_id', $proposalId)->first();
        if (! $record) {
            return;
        }

        $counts = ResearchOutput::where('proposal_id', $proposalId)
            ->selectRaw('
                COUNT(*) as total,
                SUM(output_type IN ("journal_article","conference_paper","book")) as pubs,
                SUM(output_type = "patent") as patents
            ')
            ->first();

        $record->update([
            'total_outputs' => (int) ($counts->total ?? 0),
            'publications_count' => (int) ($counts->pubs ?? 0),
            'patents_count' => (int) ($counts->patents ?? 0),
        ]);
    }
}
