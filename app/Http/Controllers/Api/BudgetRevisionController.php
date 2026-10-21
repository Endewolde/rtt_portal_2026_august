<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Models\BudgetRevisionRequest;
use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\RejectionReasons;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BudgetRevisionController extends Controller
{
    private const ELIGIBLE_STATUSES = ['funded', 'midterm_evaluation'];

    /** PI requests a change to their already-funded proposal's budget breakdown. */
    public function store(string $proposalId, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|min:20|max:2000',
            'items' => 'required|array|min:1',
            'items.*.category' => 'required|string|max:100',
            'items.*.item_description' => 'required|string|max:255',
            'items.*.amount' => 'required|numeric|min:0',
            'items.*.justification' => 'nullable|string|max:1000',
        ]);

        $proposal = Proposal::findOrFail($proposalId);

        if ($proposal->pi_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (! in_array($proposal->status, self::ELIGIBLE_STATUSES, true)) {
            return response()->json(['message' => 'Budget revisions can only be requested for a funded proposal that is still active.'], 422);
        }

        if (BudgetRevisionRequest::where('proposal_id', $proposalId)->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'A budget revision request is already pending for this proposal.'], 422);
        }

        $currentTotal = ProposalBudget::where('proposal_id', $proposalId)->sum('amount');
        $requestedTotal = collect($validated['items'])->sum('amount');

        $revision = BudgetRevisionRequest::create([
            'proposal_id' => $proposalId,
            'requested_by' => $request->user()->id,
            'reason' => $validated['reason'],
            'current_total' => $currentTotal,
            'requested_total' => $requestedTotal,
            'requested_items' => $validated['items'],
            'status' => 'pending',
        ]);

        AuditLogger::log('budget_revision.requested', Proposal::class, $proposalId, $request->user()->id, null, [
            'tracker' => $proposal->tracker_number,
            'current_total' => $currentTotal,
            'requested_total' => $requestedTotal,
        ]);

        $this->notifyOfficers($proposal, $request->user(), $revision);

        return response()->json([
            'data' => $revision,
            'message' => 'Your budget revision request has been submitted for review.',
        ], 201);
    }

    /** Officer lists all budget revision requests. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('budget_revisions.review')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $revisions = BudgetRevisionRequest::with([
            'proposal:id,tracker_number,title,category,college_id',
            'proposal.college:id,name',
            'requestedBy:id,name,email',
            'resolvedBy:id,name',
        ])
            ->whereHas('proposal', function ($q) use ($request) {
                if ($request->_category_scope) {
                    $q->where('category', $request->_category_scope);
                } elseif ($request->filled('category')) {
                    $q->where('category', $request->category);
                }

                if ($request->_college_scope) {
                    $q->where('college_id', $request->_college_scope);
                } elseif ($request->filled('college_id')) {
                    $q->where('college_id', $request->college_id);
                }
            })
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json(['data' => $revisions]);
    }

    /** Officer approves a budget revision — replaces the proposal's budget line items with the requested ones. */
    public function approve(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('budget_revisions.review')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $revision = BudgetRevisionRequest::with('proposal')->findOrFail($id);

        if ($revision->status !== 'pending') {
            return response()->json(['message' => 'This budget revision request has already been resolved.'], 422);
        }

        DB::transaction(function () use ($revision, $request) {
            ProposalBudget::where('proposal_id', $revision->proposal_id)->delete();

            foreach ($revision->requested_items as $item) {
                ProposalBudget::create([
                    'proposal_id' => $revision->proposal_id,
                    'category' => $item['category'],
                    'item_description' => $item['item_description'],
                    'amount' => $item['amount'],
                    'justification' => $item['justification'] ?? null,
                ]);
            }

            $revision->update([
                'status' => 'approved',
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
                'resolution_notes' => $request->input('resolution_notes'),
            ]);
        });

        AuditLogger::log('budget_revision.approved', Proposal::class, $revision->proposal_id, $request->user()->id);

        $pi = $revision->proposal->pi ?? User::find($revision->proposal->pi_user_id);
        if ($pi) {
            $this->notifyPi($pi, $revision, 'approved');
        }

        return response()->json(['data' => $revision->fresh(), 'message' => 'Budget revision approved and applied.']);
    }

    /** Officer denies a budget revision — the current budget is left untouched. */
    public function reject(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('budget_revisions.review')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        RejectionReasons::apply($request, 'budget_revision');
        $validated = $request->validate(['reason' => 'required|string|min:10']);

        $revision = BudgetRevisionRequest::with('proposal')->findOrFail($id);

        if ($revision->status !== 'pending') {
            return response()->json(['message' => 'This budget revision request has already been resolved.'], 422);
        }

        $revision->update([
            'status' => 'denied',
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
            'resolution_notes' => $validated['reason'],
        ]);

        AuditLogger::log('budget_revision.denied', Proposal::class, $revision->proposal_id, $request->user()->id);

        $pi = $revision->proposal->pi ?? User::find($revision->proposal->pi_user_id);
        if ($pi) {
            $this->notifyPi($pi, $revision, 'denied');
        }

        return response()->json(['data' => $revision->fresh(), 'message' => 'Budget revision request denied.']);
    }

    /** PI's own latest budget revision request for a proposal. */
    public function show(string $proposalId): JsonResponse
    {
        $revision = BudgetRevisionRequest::where('proposal_id', $proposalId)->latest()->first();

        return response()->json(['data' => $revision]);
    }

    private function notifyOfficers(Proposal $proposal, User $submitter, BudgetRevisionRequest $revision): void
    {
        $roleMap = [
            'research' => 'research_officer',
            'community_engagement' => 'community_officer',
            'technology_transfer' => 'technology_officer',
        ];
        $roles = array_values(array_filter(['central_officer', $roleMap[$proposal->category] ?? null]));

        foreach (User::role($roles)->where('status', 'active')->get()
            ->merge(User::customRoleHolders('budget_revisions.review', $proposal->college_id, $proposal->category))->unique('id') as $officer) {
            try {
                SendEmailNotificationJob::deliver($officer, 'budget_revision_requested', [
                    'tracker_number' => $proposal->tracker_number,
                    'title' => $proposal->title,
                    'submitter_name' => $submitter->name,
                    'requested_total' => $revision->requested_total,
                ]);
            } catch (\Exception $e) {
                Log::error("Budget revision officer notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyPi(User $pi, BudgetRevisionRequest $revision, string $decision): void
    {
        try {
            SendEmailNotificationJob::deliver($pi, 'budget_revision_resolved', [
                'tracker_number' => $revision->proposal->tracker_number,
                'title' => $revision->proposal->title,
                'decision' => $decision,
                'resolution_notes' => $revision->resolution_notes,
            ]);
        } catch (\Exception $e) {
            Log::error("Budget revision PI notify failed: {$e->getMessage()}");
        }
    }
}
