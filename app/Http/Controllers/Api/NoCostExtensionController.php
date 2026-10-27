<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Models\NoCostExtensionRequest;
use App\Models\Proposal;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\Programmes;
use App\Support\RejectionReasons;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NoCostExtensionController extends Controller
{
    private const ELIGIBLE_STATUSES = ['funded', 'midterm_evaluation'];

    /** PI requests more time to complete an already-funded project, at no additional cost. */
    public function store(string $proposalId, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|min:20|max:2000',
            'requested_duration_months' => 'required|integer|min:1|max:120',
        ]);

        $proposal = Proposal::findOrFail($proposalId);

        if ($proposal->pi_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (! in_array($proposal->status, self::ELIGIBLE_STATUSES, true)) {
            return response()->json(['message' => 'A no-cost extension can only be requested for a funded proposal that is still active.'], 422);
        }

        if ($validated['requested_duration_months'] <= $proposal->duration_months) {
            return response()->json(['message' => 'The requested duration must be longer than the current project duration.'], 422);
        }

        if (NoCostExtensionRequest::where('proposal_id', $proposalId)->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'A no-cost extension request is already pending for this proposal.'], 422);
        }

        $extension = NoCostExtensionRequest::create([
            'proposal_id' => $proposalId,
            'requested_by' => $request->user()->id,
            'reason' => $validated['reason'],
            'current_duration_months' => $proposal->duration_months,
            'requested_duration_months' => $validated['requested_duration_months'],
            'status' => 'pending',
        ]);

        AuditLogger::log('no_cost_extension.requested', Proposal::class, $proposalId, $request->user()->id, null, [
            'tracker' => $proposal->tracker_number,
            'current_duration_months' => $proposal->duration_months,
            'requested_duration_months' => $validated['requested_duration_months'],
        ]);

        $this->notifyOfficers($proposal, $request->user(), $extension);

        return response()->json([
            'data' => $extension,
            'message' => 'Your no-cost extension request has been submitted for review.',
        ], 201);
    }

    /** Officer lists all no-cost extension requests. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('no_cost_extensions.review')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Every request within the reviewer's scope, newest first; the page filters and counts them.
        $query = NoCostExtensionRequest::with([
            'proposal:id,tracker_number,title,category,college_id,pi_user_id,academic_year,status,duration_months',
            'proposal.college:id,name',
            'proposal.award:id,proposal_id,approved_at,awarded_amount',
            'requestedBy:id,name,email',
            'resolvedBy:id,name',
        ])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->filled('category'), fn ($q) => $q->whereHas('proposal', fn ($p) => $p->where('category', $request->category)))
            ->when($request->filled('college_id'), fn ($q) => $q->whereHas('proposal', fn ($p) => $p->where('college_id', $request->college_id)))
            ->orderByDesc('created_at');
        $request->user()->accessScope()->constrainThrough($query, 'proposal');
        $extensions = $query->limit(500)->get();

        return response()->json([
            'data' => $extensions,
            'meta' => ['counts' => $extensions->countBy('status')],
        ]);
    }

    /** Officer approves a pending request — extends the proposal's duration_months. */
    public function approve(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('no_cost_extensions.review')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $extension = NoCostExtensionRequest::with('proposal')->findOrFail($id);

        if ($denied = $this->outOfScope($request, $extension)) {
            return $denied;
        }

        if ($extension->status !== 'pending') {
            return response()->json(['message' => 'This no-cost extension request has already been resolved.'], 422);
        }

        if (! in_array($extension->proposal->status, self::ELIGIBLE_STATUSES, true)) {
            return response()->json(['message' => 'The project is no longer running, so its duration cannot be extended.'], 422);
        }

        DB::transaction(function () use ($extension, $request) {
            $extension->proposal->update(['duration_months' => $extension->requested_duration_months]);

            $extension->update([
                'status' => 'approved',
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
                'resolution_notes' => $request->input('resolution_notes'),
            ]);
        });

        AuditLogger::log('no_cost_extension.approved', Proposal::class, $extension->proposal_id, $request->user()->id);

        $pi = $extension->proposal->pi ?? User::find($extension->proposal->pi_user_id);
        if ($pi) {
            $this->notifyPi($pi, $extension, 'approved');
        }

        return response()->json(['data' => $extension->fresh(), 'message' => 'No-cost extension approved and applied.']);
    }

    /** Officer denies a pending request — the project duration is left untouched. */
    public function reject(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('no_cost_extensions.review')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        RejectionReasons::apply($request, 'no_cost_extension');
        $validated = $request->validate(['reason' => 'required|string|min:10']);

        $extension = NoCostExtensionRequest::with('proposal')->findOrFail($id);

        if ($denied = $this->outOfScope($request, $extension)) {
            return $denied;
        }

        if ($extension->status !== 'pending') {
            return response()->json(['message' => 'This no-cost extension request has already been resolved.'], 422);
        }

        $extension->update([
            'status' => 'denied',
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
            'resolution_notes' => $validated['reason'],
        ]);

        AuditLogger::log('no_cost_extension.denied', Proposal::class, $extension->proposal_id, $request->user()->id);

        $pi = $extension->proposal->pi ?? User::find($extension->proposal->pi_user_id);
        if ($pi) {
            $this->notifyPi($pi, $extension, 'denied');
        }

        return response()->json(['data' => $extension->fresh(), 'message' => 'No-cost extension request denied.']);
    }

    /** PI's own latest no-cost extension request for a proposal. */
    public function show(string $proposalId): JsonResponse
    {
        $extension = NoCostExtensionRequest::where('proposal_id', $proposalId)->latest()->first();

        return response()->json(['data' => $extension]);
    }

    /** A reviewer decides only requests for projects within their own scope. */
    private function outOfScope(Request $request, NoCostExtensionRequest $extension): ?JsonResponse
    {
        $proposal = $extension->proposal;

        return $proposal && $request->user()->accessScope()->covers($proposal->college_id, $proposal->category)
            ? null
            : response()->json(['message' => 'This request is outside your area.'], 403);
    }

    private function notifyOfficers(Proposal $proposal, User $submitter, NoCostExtensionRequest $extension): void
    {
        $roles = ['central_officer', ...Programmes::directorRoles($proposal->category)];

        foreach (User::role($roles)->where('status', 'active')->get()
            ->merge(User::customRoleHolders('no_cost_extensions.review', $proposal->college_id, $proposal->category))->unique('id') as $officer) {
            try {
                SendEmailNotificationJob::deliver($officer, 'no_cost_extension_requested', [
                    'tracker_number' => $proposal->tracker_number,
                    'title' => $proposal->title,
                    'submitter_name' => $submitter->name,
                    'requested_duration_months' => $extension->requested_duration_months,
                ]);
            } catch (\Exception $e) {
                Log::error("No-cost extension officer notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyPi(User $pi, NoCostExtensionRequest $extension, string $decision): void
    {
        try {
            SendEmailNotificationJob::deliver($pi, 'no_cost_extension_resolved', [
                'tracker_number' => $extension->proposal->tracker_number,
                'title' => $extension->proposal->title,
                'decision' => $decision,
                'resolution_notes' => $extension->resolution_notes,
            ]);
        } catch (\Exception $e) {
            Log::error("No-cost extension PI notify failed: {$e->getMessage()}");
        }
    }
}
