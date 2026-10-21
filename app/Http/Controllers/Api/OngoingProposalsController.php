<?php

namespace App\Http\Controllers\Api;

use App\Exports\OngoingProposalsExport;
use App\Http\Controllers\Controller;
use App\Models\Award;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\ThresholdSetting;
use App\Models\User;
use App\Services\LegacyGrantService;
use App\Services\TrackerNumberService;
use App\Services\WorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Single consolidated view of every proposal that's been funded but not yet
 * archived (status funded/midterm_evaluation/completed) — a proposal appears here
 * automatically the moment its status becomes funded and drops off once it's
 * archived, no separate "activation" step. Deliberately a hub, not a duplicate
 * action surface: it links into the existing Midterm Evaluation / Completion
 * Workshop pages for the actual scheduling/scoring work rather than reimplementing
 * it here — the one exception is archive(), since no other page in the app ever
 * actually triggers the completed -> archived transition (it exists in the
 * workflow graph but was previously unreachable from any controller).
 */
class OngoingProposalsController extends Controller
{
    private const ONGOING_STATUSES = ['funded', 'midterm_evaluation', 'completed'];

    // Access: monitoring.ongoing (the page), monitoring.archive (completed ->
    // archived) and monitoring.legacy_grants (bypasses the whole review workflow,
    // so admin-core only by default) — see config/access.php.

    public function __construct(
        private WorkflowService $workflowService,
        private LegacyGrantService $legacyGrants,
    ) {}

    private const SORTABLE_COLUMNS = [
        'tracker' => 'proposals.tracker_number',
        'title' => 'proposals.title',
        'pi' => 'ongoing_pi.name',
        'college' => 'ongoing_college.name',
        'funded_at' => 'ongoing_award.approved_at',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('monitoring.ongoing')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $base = $this->scopedBaseQuery($request);

        $listQuery = $this->applyListFilters((clone $base), $request)
            ->with($this->eagerLoads())
            ->select('proposals.*');

        $this->applySort($listQuery, $request);

        $proposals = $listQuery->paginate($request->integer('per_page', 20))
            ->through(fn (Proposal $p) => $this->annotate($p));

        $kpis = $this->computeKpis(clone $base);

        // Chart data — grouped over the full scoped set, not just the current
        // page, so pagination never skews what the charts show.
        $byCollege = (clone $base)
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->selectRaw('colleges.id, colleges.name, COUNT(*) as total')
            ->groupBy('colleges.id', 'colleges.name')
            ->orderByDesc('total')
            ->get();

        $byCategory = (clone $base)
            ->selectRaw('proposals.category, COUNT(*) as total')
            ->groupBy('proposals.category')
            ->pluck('total', 'category');

        $collegesQuery = DB::table('colleges')->where('status', 'active')->select('id', 'name')->orderBy('name');
        if ($request->_college_scope) {
            $collegesQuery->where('id', $request->_college_scope);
        }

        return response()->json([
            'data' => [
                'kpis' => $kpis,
                'by_college' => $byCollege,
                'by_category' => $byCategory,
                'colleges' => $collegesQuery->get(),
                'proposals' => $proposals,
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Export the SAME filtered/scoped/sorted list shown in the table (no pagination) as an .xlsx file. */
    public function export(Request $request): BinaryFileResponse
    {
        $user = $request->user();

        if (! $user?->can('monitoring.ongoing')) {
            abort(403, 'Unauthorized.');
        }

        $listQuery = $this->applyListFilters($this->scopedBaseQuery($request), $request)
            ->with($this->eagerLoads())
            ->select('proposals.*');

        $this->applySort($listQuery, $request);

        $proposals = $listQuery->get()->map(fn (Proposal $p) => $this->annotate($p));

        $filename = 'ongoing_proposals_'.now()->format('Ymd_His').'.xlsx';

        return Excel::download(new OngoingProposalsExport($proposals), $filename);
    }

    /** @return array<string, mixed> Shared by index() and export() so they can never drift apart. */
    private function eagerLoads(): array
    {
        return [
            'award',
            'pi:id,name',
            'college:id,name',
            'midtermEvaluations' => fn ($q) => $q->latest('evaluation_date'),
            'completionWorkshop',
            'budgetAllocations:id,proposal_id,allocated_amount,remaining_balance',
            'outputs:id,proposal_id',
            'budgetRequests' => fn ($q) => $q->select('id', 'proposal_id', 'status')->with('disbursements:id,budget_request_id'),
        ];
    }

    /**
     * Close out a completed proposal — the only write action this hub performs
     * itself, since no other page in the app ever calls this transition. Restricted
     * to central_officer/super_admin, matching the transition's own role list in
     * WorkflowStageSeeder (completed -> archived, action "archive").
     */
    public function archive(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('monitoring.archive')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $proposal = Proposal::findOrFail($id);

        if ($proposal->status !== 'completed') {
            return response()->json(['data' => null, 'message' => 'Only completed proposals can be archived.', 'errors' => []], 422);
        }

        $this->workflowService->transition($proposal, 'archive', $user, 'Archived from Ongoing Proposals.');

        return response()->json(['data' => null, 'message' => 'Proposal archived.', 'errors' => [], 'meta' => []]);
    }

    /**
     * Search proposals eligible for a legacy grant — i.e. anything not already
     * funded/ongoing/archived and without an existing Award. Feeds the picker in
     * the "Grant Legacy Proposal" dialog.
     */
    public function grantable(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('monitoring.legacy_grants')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $query = Proposal::query()
            ->whereNull('deleted_at')
            ->whereNotIn('status', [...self::ONGOING_STATUSES, 'archived'])
            ->whereDoesntHave('award')
            ->with(['pi:id,name', 'college:id,name']);

        if ($request->filled('q')) {
            $term = '%'.$request->q.'%';
            $query->where(fn ($q) => $q
                ->where('tracker_number', 'like', $term)
                ->orWhere('title', 'like', $term));
        }

        $proposals = $query->orderByDesc('updated_at')
            ->limit(20)
            ->get(['id', 'tracker_number', 'title', 'status', 'category', 'college_id', 'pi_user_id']);

        return response()->json(['data' => $proposals, 'message' => '', 'errors' => []]);
    }

    /**
     * Administrative override for a proposal that was actually granted outside
     * (or before) this system's normal submit -> review -> award workflow — e.g.
     * legacy data, or a proposal recorded under a status that never reflected
     * reality. Bypasses WorkflowService (whose transitions are strictly one-hop
     * and can't jump an arbitrary status straight to "funded"), so it does its own
     * workflow_logs + audit_logs bookkeeping and creates the Award directly,
     * mirroring the one other precedent for this in the app (ProposalAppealController).
     */
    public function grantLegacy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('monitoring.legacy_grants')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'justification' => 'required|string|min:10',
            'awarded_amount' => 'required|numeric|min:0',
            'grant_reference' => 'nullable|string|max:50|unique:awards,grant_reference',
            'approved_at' => 'nullable|date',
        ]);

        $proposal = Proposal::findOrFail($id);

        if ($error = $this->legacyGrantEligibilityError($proposal)) {
            return response()->json(['data' => null, 'message' => $error, 'errors' => []], 422);
        }

        $award = $this->performLegacyGrant(
            $proposal,
            $user,
            $validated['justification'],
            (float) $validated['awarded_amount'],
            $validated['grant_reference'] ?? null,
            isset($validated['approved_at']) ? Carbon::parse($validated['approved_at']) : null,
        );

        return response()->json([
            'data' => $award,
            'message' => 'Proposal granted — now tracked as ongoing.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * For a proposal that was fully paper-based/manual and was never entered into this
     * system at all — there's no existing Proposal row for grantLegacy() to move, so this
     * creates one from scratch (with a real tracker_number from the same generator the
     * proposal wizard uses) and immediately grants it. Deliberately narrower than the
     * normal proposal wizard: the PI must already have an account (no inline user
     * creation — keeps this from silently provisioning login-capable accounts as a
     * side effect of a grant action).
     */
    public function createLegacy(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('monitoring.legacy_grants')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'category' => 'required|in:research,community_engagement,technology_transfer',
            'college_id' => 'required|uuid|exists:colleges,id',
            'department_id' => 'required|uuid|exists:departments,id',
            'pi_user_id' => 'required|uuid|exists:users,id',
            'academic_year' => 'required|string|max:20',
            'justification' => 'required|string|min:10',
            'awarded_amount' => 'required|numeric|min:0',
            'grant_reference' => 'nullable|string|max:50|unique:awards,grant_reference',
            'approved_at' => 'nullable|date',
            'co_investigators' => 'nullable|array',
            'co_investigators.*.user_id' => 'required|uuid|exists:users,id|different:pi_user_id',
            'co_investigators.*.contribution_percentage' => 'nullable|numeric|min:0|max:100',
            // Same fields the normal proposal wizard's Step 1 (Basic Info) collects —
            // so a legacy-created proposal reads the same as one submitted normally.
            'abstract' => 'required|string|min:100',
            'keywords' => 'nullable|string|max:1000',
            'focus_area' => 'required|string|max:255',
            'research_type' => 'required_if:category,research|nullable|string|max:255',
            'duration_months' => 'required|integer|min:1|max:120',
            'ethical_clearance_required' => 'nullable|boolean',
            'ethical_clearance_number' => 'nullable|required_if:ethical_clearance_required,true|string|max:100',
        ]);

        $department = Department::find($validated['department_id']);
        if ($department->college_id !== $validated['college_id']) {
            return response()->json(['data' => null, 'message' => 'This department does not belong to the selected college.', 'errors' => []], 422);
        }

        // PIs in this app are tagged with the 'staff' role, not a dedicated 'pi'
        // role — matches the same convention the co-investigator search already
        // uses (Step3CoInvestigators.jsx searches role=staff).
        $pi = User::find($validated['pi_user_id']);
        if (! $pi->hasRole('staff')) {
            return response()->json(['data' => null, 'message' => 'The selected user does not hold the staff role.', 'errors' => []], 422);
        }

        $coInvestigators = collect($validated['co_investigators'] ?? []);
        if ($coInvestigators->pluck('user_id')->unique()->count() !== $coInvestigators->count()) {
            return response()->json(['data' => null, 'message' => 'The same co-investigator was added more than once.', 'errors' => []], 422);
        }

        $award = DB::transaction(function () use ($validated, $coInvestigators, $user) {
            $call = $this->reservedLegacyCall($validated['category'], $validated['academic_year'], $user);

            $proposal = Proposal::create([
                'tracker_number' => app(TrackerNumberService::class)->generate($validated['category'], $validated['academic_year']),
                'proposal_call_id' => $call->id,
                'category' => $validated['category'],
                'title' => $validated['title'],
                'abstract' => $validated['abstract'],
                'keywords' => $validated['keywords'] ?? null,
                'focus_area' => $validated['focus_area'],
                'research_type' => $validated['category'] === 'research' ? ($validated['research_type'] ?? null) : null,
                'duration_months' => $validated['duration_months'],
                'ethical_clearance_required' => (bool) ($validated['ethical_clearance_required'] ?? false),
                'ethical_clearance_number' => ($validated['ethical_clearance_required'] ?? false) ? ($validated['ethical_clearance_number'] ?? null) : null,
                'status' => 'draft',
                'pi_user_id' => $validated['pi_user_id'],
                'college_id' => $validated['college_id'],
                'department_id' => $validated['department_id'],
                'academic_year' => $validated['academic_year'],
                'created_by' => $user->id,
            ]);

            $coContribTotal = $coInvestigators->sum(fn ($c) => (float) ($c['contribution_percentage'] ?? 0));

            ProposalMember::create([
                'proposal_id' => $proposal->id,
                'user_id' => $proposal->pi_user_id,
                'role' => 'pi',
                'contribution_percentage' => max(0, 100 - $coContribTotal),
                'status' => 'active',
                'invitation_status' => 'accepted',
                'joined_at' => now(),
            ]);

            foreach ($coInvestigators as $coI) {
                ProposalMember::create([
                    'proposal_id' => $proposal->id,
                    'user_id' => $coI['user_id'],
                    'role' => 'co_investigator',
                    'contribution_percentage' => $coI['contribution_percentage'] ?? 0,
                    'status' => 'active',
                    // Recorded historically, not a live invite — the co-investigator
                    // already knows they took part, so this isn't sent as a pending ask.
                    'invitation_status' => 'accepted',
                    'joined_at' => now(),
                ]);
            }

            return $this->performLegacyGrant(
                $proposal,
                $user,
                $validated['justification'],
                (float) $validated['awarded_amount'],
                $validated['grant_reference'] ?? null,
                isset($validated['approved_at']) ? Carbon::parse($validated['approved_at']) : null,
            );
        });

        return response()->json([
            'data' => $award,
            'message' => 'Proposal created and granted — now tracked as ongoing.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Distinct academic years already recorded on proposals — feeds the New Proposal form's dropdown. */
    public function academicYears(Request $request): JsonResponse
    {
        if (! $request->user()?->can('monitoring.legacy_grants')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $years = DB::table('proposals')
            ->whereNull('deleted_at')
            ->whereNotNull('academic_year')
            ->distinct()
            ->orderByDesc('academic_year')
            ->pluck('academic_year');

        return response()->json(['data' => $years, 'message' => '', 'errors' => []]);
    }

    /**
     * Every proposal needs a real proposal_call_id (NOT NULL + FK, no placeholder
     * concept exists elsewhere in the app), so createLegacy() attaches to one reserved,
     * permanently-closed call per (category, academic_year) — created once, reused after.
     */
    private function reservedLegacyCall(string $category, string $academicYear, User $user): ProposalCall
    {
        $slug = "legacy-manual-grants-{$category}-".Str::slug($academicYear);

        return ProposalCall::firstOrCreate(
            ['slug' => $slug],
            [
                'academic_year' => $academicYear,
                'category' => $category,
                'title' => 'Legacy / Manual Grants — '.ucwords(str_replace('_', ' ', $category)).' ('.$academicYear.')',
                'description' => 'System-provisioned holder for proposals granted outside the normal workflow via Grant Legacy Proposal. Never open for submissions.',
                'start_date' => now()->toDateString(),
                'end_date' => now()->toDateString(),
                'status' => 'closed',
                'is_open' => false,
                'created_by' => $user->id,
            ]
        );
    }

    /** Null when eligible, otherwise the reason it can't be legacy-granted. Shared by the single and bulk-import paths. */
    private function legacyGrantEligibilityError(Proposal $proposal): ?string
    {
        return $this->legacyGrants->eligibilityError($proposal);
    }

    private function performLegacyGrant(
        Proposal $proposal,
        User $user,
        string $justification,
        float $amount,
        ?string $grantReference,
        ?Carbon $approvedAt,
    ): Award {
        return $this->legacyGrants->grant($proposal, $user, $justification, $amount, $grantReference, $approvedAt);
    }

    /** CSV template for bulk legacy grants — same 4 columns grantLegacyImport() expects. */
    public function grantLegacyImportTemplate(Request $request): StreamedResponse|JsonResponse
    {
        if (! $request->user()?->can('monitoring.legacy_grants')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="legacy_proposals_import_template.csv"',
            'Cache-Control' => 'no-cache',
        ];

        return response()->stream(function () {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['tracker_number', 'awarded_amount', 'grant_reference', 'approved_at']);
            fputcsv($handle, ['RES-2025-2026-000123', '15000', '', '2024-01-15']);
            fputcsv($handle, ['COM-2024-2025-000045', '8000', 'GRANT-2024-000045', '']);
            fclose($handle);
        }, 200, $headers);
    }

    /**
     * Bulk version of grantLegacy() — one CSV row per proposal, one shared justification
     * for the whole batch (recorded on every row's workflow_logs/audit_logs/award notes).
     * Each row is validated and granted independently in its own transaction, so one bad
     * row is reported and skipped rather than rolling back the whole import.
     */
    public function grantLegacyImport(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('monitoring.legacy_grants')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:2048',
            'justification' => 'required|string|min:10',
        ]);

        $justification = $request->string('justification')->toString();
        $handle = fopen($request->file('file')->getRealPath(), 'r');

        $rawHeaders = fgetcsv($handle);
        if ($rawHeaders) {
            $rawHeaders[0] = ltrim($rawHeaders[0], "\xEF\xBB\xBF");
        }
        $headerMap = array_flip(array_map('trim', $rawHeaders ?? []));
        $col = fn (string $name) => $headerMap[$name] ?? null;

        $rows = [];
        $errors = [];
        $rowIndex = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowIndex++;

            $tracker = trim($row[$col('tracker_number')] ?? '');
            $amountRaw = trim($row[$col('awarded_amount')] ?? '');
            $grantReference = trim($row[$col('grant_reference')] ?? '') ?: null;
            $approvedAtRaw = trim($row[$col('approved_at')] ?? '') ?: null;

            $rowErrors = [];
            if (! $tracker) {
                $rowErrors[] = 'tracker_number is required';
            }
            if ($amountRaw === '' || ! is_numeric($amountRaw) || (float) $amountRaw < 0) {
                $rowErrors[] = 'awarded_amount must be a non-negative number';
            }
            if ($approvedAtRaw && ! strtotime($approvedAtRaw)) {
                $rowErrors[] = 'approved_at is not a valid date';
            }

            if ($rowErrors) {
                $errors[] = ['row' => $rowIndex, 'tracker_number' => $tracker ?: '—', 'error' => implode('; ', $rowErrors)];

                continue;
            }

            $rows[] = compact('rowIndex', 'tracker', 'amountRaw', 'grantReference', 'approvedAtRaw');
        }

        fclose($handle);

        $trackers = array_column($rows, 'tracker');
        $proposalsByTracker = Proposal::whereIn('tracker_number', $trackers)->with('award')->get()->keyBy('tracker_number');
        $seenGrantReferences = [];
        $created = 0;

        foreach ($rows as $r) {
            $proposal = $proposalsByTracker->get($r['tracker']);

            if (! $proposal) {
                $errors[] = ['row' => $r['rowIndex'], 'tracker_number' => $r['tracker'], 'error' => 'No proposal found with this tracker number'];

                continue;
            }

            if ($eligibilityError = $this->legacyGrantEligibilityError($proposal)) {
                $errors[] = ['row' => $r['rowIndex'], 'tracker_number' => $r['tracker'], 'error' => $eligibilityError];

                continue;
            }

            if ($r['grantReference'] && (isset($seenGrantReferences[$r['grantReference']]) || Award::where('grant_reference', $r['grantReference'])->exists())) {
                $errors[] = ['row' => $r['rowIndex'], 'tracker_number' => $r['tracker'], 'error' => 'grant_reference is already in use'];

                continue;
            }

            if ($r['grantReference']) {
                $seenGrantReferences[$r['grantReference']] = true;
            }

            $this->performLegacyGrant(
                $proposal,
                $user,
                $justification,
                (float) $r['amountRaw'],
                $r['grantReference'],
                $r['approvedAtRaw'] ? Carbon::parse($r['approvedAtRaw']) : null,
            );

            $created++;
        }

        return response()->json([
            'data' => [
                'summary' => [
                    'total' => $created + count($errors),
                    'created' => $created,
                    'errors' => count($errors),
                ],
                'errors' => $errors,
            ],
            'message' => "Import complete. {$created} granted, ".count($errors).' skipped.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Attach the computed fields the frontend needs without extra queries — everything
     * here comes from already-eager-loaded relations.
     */
    private function annotate(Proposal $p): Proposal
    {
        $latestMidterm = $p->midtermEvaluations->first();
        $allocated = (float) $p->budgetAllocations->sum('allocated_amount');
        $remaining = (float) $p->budgetAllocations->sum('remaining_balance');
        $needsMidterm = $p->status === 'funded' && $p->midtermEvaluations->isEmpty();
        $fundedAt = $p->award?->approved_at;

        $p->setAttribute('midterm_status', $latestMidterm?->status);
        $p->setAttribute('midterm_recommendation', $latestMidterm?->recommendation);
        $p->setAttribute('completion_workshop_status', $p->completionWorkshop?->status);
        $p->setAttribute('funded_at', $fundedAt);
        $p->setAttribute('budget_allocated', $allocated);
        $p->setAttribute('budget_utilized', $allocated - $remaining);
        $p->setAttribute('needs_midterm', $needsMidterm);
        $p->setAttribute(
            'needs_completion_workshop',
            $latestMidterm?->status === 'scored' && $latestMidterm?->recommendation === 'continue' && ! $p->completionWorkshop
        );
        $p->setAttribute('needs_archiving', $p->status === 'completed');
        $p->setAttribute(
            'is_overdue',
            $needsMidterm && $fundedAt && $fundedAt->diffInDays(now()) > $this->overdueThresholdDays()
        );

        // A funded proposal without an approved contract, an approved budget
        // request still waiting on its disbursement, and a running tally of
        // recorded research outputs — none of this was visible on the dashboard
        // before, even though the underlying data already existed. contract_status
        // is already a native Proposal attribute, so it's already in the response.
        $p->setAttribute('needs_contract', $p->contract_status !== 'approved');
        $p->setAttribute('outputs_count', $p->outputs->count());
        $p->setAttribute(
            'needs_disbursement',
            $p->budgetRequests->contains(fn ($br) => $br->status === 'approved' && $br->disbursements->isEmpty())
        );

        return $p;
    }

    /** Configurable via Settings — Ongoing Proposals — Midterm Overdue After (days), not hardcoded. */
    private function overdueThresholdDays(): int
    {
        return (int) (ThresholdSetting::where('key', 'ongoing_midterm_overdue_days')->value('value') ?? 90);
    }

    private function computeKpis(Builder $base): array
    {
        $awaitingMidterm = (clone $base)
            ->where('proposals.status', 'funded')
            ->whereDoesntHave('midtermEvaluations')
            ->count();

        $overdueCutoff = now()->subDays($this->overdueThresholdDays())->toDateString();
        $overdueAwaitingMidterm = (clone $base)
            ->where('proposals.status', 'funded')
            ->whereDoesntHave('midtermEvaluations')
            ->whereHas('award', fn ($q) => $q->whereDate('approved_at', '<', $overdueCutoff))
            ->count();

        $awaitingArchive = (clone $base)->where('proposals.status', 'completed')->count();

        $needsContract = (clone $base)
            ->where(fn ($q) => $q->whereNull('proposals.contract_status')->orWhere('proposals.contract_status', '!=', 'approved'))
            ->count();

        $needsDisbursement = (clone $base)
            ->whereHas('budgetRequests', fn ($q) => $q->where('status', 'approved')->whereDoesntHave('disbursements'))
            ->count();

        $total = (clone $base)->count();

        $budgetTotals = (clone $base)
            ->join('budget_allocations', 'budget_allocations.proposal_id', '=', 'proposals.id')
            ->selectRaw('COALESCE(SUM(budget_allocations.allocated_amount), 0) as allocated,
                         COALESCE(SUM(budget_allocations.allocated_amount - budget_allocations.remaining_balance), 0) as utilized')
            ->first();

        return [
            'total_ongoing' => $total,
            'awaiting_midterm' => $awaitingMidterm,
            'overdue_awaiting_midterm' => $overdueAwaitingMidterm,
            'in_midterm' => $total - $awaitingMidterm - $awaitingArchive,
            'awaiting_archive' => $awaitingArchive,
            'needs_contract' => $needsContract,
            'needs_disbursement' => $needsDisbursement,
            'total_budget_allocated' => (float) ($budgetTotals->allocated ?? 0),
            'total_budget_utilized' => (float) ($budgetTotals->utilized ?? 0),
        ];
    }

    /**
     * Every column here MUST be qualified with `proposals.` — applySort() joins
     * `users`/`colleges`, which also have their own `deleted_at`/`status` columns
     * (same ambiguous-column guard as ProposalPipelineController).
     */
    private function scopedBaseQuery(Request $request): Builder
    {
        $base = Proposal::query()
            ->whereNull('proposals.deleted_at')
            ->whereIn('proposals.status', self::ONGOING_STATUSES);

        if ($request->_category_scope) {
            $base->where('proposals.category', $request->_category_scope);
        } elseif ($request->filled('category')) {
            $base->where('proposals.category', $request->category);
        }

        if ($request->_college_scope) {
            $base->where('proposals.college_id', $request->_college_scope);
        } elseif ($request->filled('college_id')) {
            $base->where('proposals.college_id', $request->college_id);
        }

        return $base;
    }

    private function applyListFilters(Builder $query, Request $request): Builder
    {
        if ($request->filled('status')) {
            $overdueCutoff = now()->subDays($this->overdueThresholdDays())->toDateString();

            match ($request->status) {
                'awaiting_midterm' => $query->where('proposals.status', 'funded')->whereDoesntHave('midtermEvaluations'),
                'in_midterm' => $query->where(fn ($q) => $q
                    ->where('proposals.status', 'midterm_evaluation')
                    ->orWhere(fn ($q2) => $q2->where('proposals.status', 'funded')->whereHas('midtermEvaluations'))),
                'overdue' => $query->where('proposals.status', 'funded')
                    ->whereDoesntHave('midtermEvaluations')
                    ->whereHas('award', fn ($q) => $q->whereDate('approved_at', '<', $overdueCutoff)),
                'awaiting_archive' => $query->where('proposals.status', 'completed'),
                'needs_contract' => $query->where(fn ($q) => $q->whereNull('proposals.contract_status')->orWhere('proposals.contract_status', '!=', 'approved')),
                'needs_disbursement' => $query->whereHas('budgetRequests', fn ($q) => $q->where('status', 'approved')->whereDoesntHave('disbursements')),
                default => null,
            };
        }

        if ($request->filled('q')) {
            $term = '%'.$request->q.'%';
            $query->where(fn ($q) => $q
                ->where('proposals.tracker_number', 'like', $term)
                ->orWhere('proposals.title', 'like', $term)
                ->orWhereHas('pi', fn ($p) => $p->where('name', 'like', $term)));
        }

        return $query;
    }

    private function applySort(Builder $query, Request $request): void
    {
        $sortKey = $request->get('sort', 'funded_at');
        $direction = $request->get('direction') === 'asc' ? 'asc' : 'desc';

        if (! array_key_exists($sortKey, self::SORTABLE_COLUMNS)) {
            $sortKey = 'funded_at';
        }

        if ($sortKey === 'pi') {
            $query->leftJoin('users as ongoing_pi', 'proposals.pi_user_id', '=', 'ongoing_pi.id');
        } elseif ($sortKey === 'college') {
            $query->leftJoin('colleges as ongoing_college', 'proposals.college_id', '=', 'ongoing_college.id');
        } elseif ($sortKey === 'funded_at') {
            $query->leftJoin('awards as ongoing_award', 'proposals.id', '=', 'ongoing_award.proposal_id');
        }

        $query->orderBy(self::SORTABLE_COLUMNS[$sortKey], $direction);

        if ($sortKey !== 'funded_at') {
            $query->orderBy('proposals.updated_at', 'desc');
        }
    }
}
