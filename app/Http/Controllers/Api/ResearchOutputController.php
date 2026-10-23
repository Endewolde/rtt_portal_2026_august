<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Models\User;
use App\Services\DoiLookupService;
use App\Services\ResearchOutputService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ResearchOutputController extends Controller
{
    public function __construct(
        private ResearchOutputService $outputService,
        private DoiLookupService $doiLookup,
    ) {}

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
        return response()->json(['data' => $this->eligibleQuery($request->user())->orderBy('title')->get(), 'message' => '', 'errors' => [], 'meta' => []]);
    }

    /**
     * Fill in an output from its DOI (Crossref), suggest the project it belongs to and
     * say if it is already recorded.
     */
    public function lookupDoi(Request $request): JsonResponse
    {
        $request->validate(['doi' => ['required', 'string', 'max:300']]);
        $user = $request->user();

        $result = $this->doiLookup->lookup($request->string('doi')->toString());
        if (! $result['found']) {
            return response()->json(['data' => null, 'message' => $result['message'], 'errors' => [], 'meta' => []], 422);
        }

        $existing = ($id = $this->doiLookup->existingOutputId($result['doi']))
            ? ResearchOutput::with('proposal:id,tracker_number,title')->find($id, ['id', 'title', 'proposal_id'])
            : null;

        return response()->json([
            'data' => $result + [
                'suggestion' => $this->doiLookup->suggestProject(
                    $this->eligibleQuery($user)->get(['id', 'title']),
                    $result['fields']['title'] ?? null,
                    $result['funding'],
                ),
                'existing' => $existing ? [
                    'id' => $existing->id,
                    'title' => $existing->title,
                    'tracker_number' => $existing->proposal?->tracker_number,
                ] : null,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Projects this user may record outputs for. */
    private function eligibleQuery(User $user): Builder
    {
        $query = Proposal::whereIn('status', ResearchOutputService::RECORDABLE_STATUSES)
            ->with(['college:id,name'])
            ->select('id', 'tracker_number', 'title', 'college_id', 'status', 'academic_year', 'category');

        $user->accessScope()->constrain($query, 'proposals', fn ($q) => $q->where(fn ($q) => $q->where('pi_user_id', $user->id)
            ->orWhereHas('members', fn ($sq) => $sq->where('user_id', $user->id)->where('status', 'active'))));

        return $query;
    }

    /** A clean DOI, or a validation error when it is malformed or already recorded on another output. */
    private function checkDoi(array &$validated, ?string $exceptOutputId = null): void
    {
        if (empty($validated['doi'])) {
            return;
        }

        $doi = DoiLookupService::normalize($validated['doi']);
        if (! $doi) {
            throw ValidationException::withMessages(['doi' => 'That doesn\'t look like a DOI. It starts with 10. — for example 10.1016/j.jenvman.2024.120345.']);
        }

        $existing = $this->doiLookup->existingOutputId($doi);
        if ($existing && $existing !== $exceptOutputId) {
            $title = ResearchOutput::whereKey($existing)->value('title');
            throw ValidationException::withMessages(['doi' => "This DOI is already recorded as \"{$title}\"."]);
        }

        $validated['doi'] = $doi;
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
        $this->checkDoi($validated);

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

        $this->checkDoi($validated, $output->id);

        if (isset($validated['title'])) {
            $output->title = $validated['title'];
        }
        $output->description = $validated['description'] ?? $output->description;
        $output->save();
        $this->outputService->updateDetails($output, $validated);

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

        if (! $user->can('research_outputs.verify')) {
            abort(403, 'Only college officers can verify research outputs.');
        }

        $output = ResearchOutput::with(['proposal:id,college_id'])->findOrFail($id);

        if (! $user->accessScope()->covers($output->proposal?->college_id, $output->proposal?->category)) {
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

        if (! $user->can('research_outputs.approve')) {
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
        // Within the role's data scope; others see outputs they recorded or that
        // belong to their own projects.
        $user->accessScope()->constrainThrough($query, 'proposal', fn ($q) => $q->where(fn ($q) => $q->where('recorded_by', $user->id)
            ->orWhereHas('proposal', fn ($sq) => $sq->where('pi_user_id', $user->id)
                ->orWhereHas('members', fn ($ssq) => $ssq->where('user_id', $user->id)->where('status', 'active')))));
    }

    private function authorizeProposalAccess(User $user, string $proposalId): void
    {
        $proposal = Proposal::findOrFail($proposalId);

        // Officers may record outputs for any project within their scope.
        if ($user->can('research_outputs.record_any') && $user->accessScope()->covers($proposal->college_id, $proposal->category)) {
            return;
        }

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
