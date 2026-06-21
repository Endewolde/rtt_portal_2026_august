<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Models\Proposal;
use App\Models\ProposalAppeal;
use App\Models\User;
use App\Services\WorkflowService;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ProposalAppealController extends Controller
{
    public function __construct(private WorkflowService $workflowService) {}

    /** PI submits an appeal for a rejected proposal. */
    public function store(string $proposalId, Request $request): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:20|max:2000']);

        $proposal = Proposal::findOrFail($proposalId);

        if ($proposal->status !== 'rejected') {
            return response()->json(['message' => 'Only rejected proposals can be appealed.'], 422);
        }

        if (ProposalAppeal::where('proposal_id', $proposalId)->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'An appeal is already pending for this proposal.'], 422);
        }

        $appeal = ProposalAppeal::create([
            'proposal_id' => $proposalId,
            'submitted_by' => $request->user()->id,
            'reason' => $request->reason,
            'status' => 'pending',
        ]);

        AuditLogger::log('appeal.submitted', Proposal::class, $proposalId, $request->user()->id, null, [
            'tracker' => $proposal->tracker_number,
        ]);

        // Notify central/research officers
        $this->notifyOfficers($proposal, $request->user());

        return response()->json([
            'data' => $appeal,
            'message' => 'Your appeal has been submitted. The RTT Office will review it and notify you.',
        ], 201);
    }

    /** Admin lists all pending appeals. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(['super_admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $appeals = ProposalAppeal::with([
            'proposal:id,tracker_number,title,category,college_id',
            'proposal.college:id,name',
            'submittedBy:id,name,email',
            'resolvedBy:id,name',
        ])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json(['data' => $appeals]);
    }

    /** Admin approves or denies an appeal. */
    public function resolve(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'decision' => 'required|in:approved,denied',
            'resolution_notes' => 'required|string|min:10',
        ]);

        if (! $request->user()?->hasAnyRole(['super_admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $appeal = ProposalAppeal::with('proposal')->findOrFail($id);

        if ($appeal->status !== 'pending') {
            return response()->json(['message' => 'This appeal has already been resolved.'], 422);
        }

        $appeal->update([
            'status' => $request->decision,
            'resolved_by' => $request->user()->id,
            'resolution_notes' => $request->resolution_notes,
            'resolved_at' => now(),
        ]);

        if ($request->decision === 'approved') {
            // Reopen the proposal to draft so PI can resubmit
            \DB::table('proposals')
                ->where('id', $appeal->proposal_id)
                ->update(['status' => 'draft', 'rejection_reason' => null, 'updated_at' => now()]);

            \DB::table('workflow_logs')->insert([
                'id' => \Str::uuid(),
                'proposal_id' => $appeal->proposal_id,
                'from_stage' => 'rejected',
                'action' => 'appeal_approved',
                'to_stage' => 'draft',
                'actor_id' => $request->user()->id,
                'notes' => $request->resolution_notes,
                'metadata' => json_encode(['appeal_id' => $appeal->id]),
                'created_at' => now(),
            ]);
        }

        // Notify the PI of the decision
        $proposal = $appeal->proposal->load('pi');
        if ($proposal->pi) {
            $this->notifyPi($proposal->pi, $proposal, $appeal);
        }

        AuditLogger::log("appeal.{$request->decision}", Proposal::class, $appeal->proposal_id, $request->user()->id);

        return response()->json([
            'data' => $appeal->fresh(),
            'message' => 'Appeal '.($request->decision === 'approved' ? 'approved — proposal returned to draft.' : 'denied.'),
        ]);
    }

    /** Get appeal status for a specific proposal. */
    public function show(string $proposalId): JsonResponse
    {
        $appeal = ProposalAppeal::where('proposal_id', $proposalId)
            ->latest()
            ->first();

        return response()->json(['data' => $appeal]);
    }

    private function notifyOfficers(Proposal $proposal, User $submitter): void
    {
        $roleMap = [
            'research' => 'research_officer',
            'community_engagement' => 'community_officer',
            'technology_transfer' => 'technology_officer',
        ];
        $role = $roleMap[$proposal->category] ?? null;
        if (! $role) {
            return;
        }

        $officers = User::role($role)->where('status', 'active')->get();
        foreach ($officers as $officer) {
            try {
                SendEmailNotificationJob::dispatchSync($officer, 'appeal_submitted', [
                    'tracker_number' => $proposal->tracker_number,
                    'title' => $proposal->title,
                    'submitter_name' => $submitter->name,
                ]);
            } catch (\Exception $e) {
                Log::error("Appeal officer notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyPi(User $pi, Proposal $proposal, ProposalAppeal $appeal): void
    {
        try {
            SendEmailNotificationJob::dispatchSync($pi, 'appeal_resolved', [
                'tracker_number' => $proposal->tracker_number,
                'title' => $proposal->title,
                'decision' => $appeal->status,
                'resolution_notes' => $appeal->resolution_notes,
            ]);
        } catch (\Exception $e) {
            Log::error("Appeal PI notify failed: {$e->getMessage()}");
        }
    }
}
