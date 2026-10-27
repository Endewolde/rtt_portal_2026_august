<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Models\DeadlineExtensionRequest;
use App\Models\Proposal;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DeadlineExtensionController extends Controller
{
    /** PI requests more time to finish and submit a draft past its call's deadline. */
    public function store(string $proposalId, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|min:20|max:2000',
            'requested_until' => 'required|date|after:now',
        ]);

        $proposal = Proposal::with('proposalCall')->findOrFail($proposalId);

        if ($proposal->pi_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($proposal->status !== 'draft') {
            return response()->json(['message' => 'Only a draft proposal can request a deadline extension.'], 422);
        }

        if (DeadlineExtensionRequest::where('proposal_id', $proposalId)->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'An extension request is already pending for this proposal.'], 422);
        }

        $extension = DeadlineExtensionRequest::create([
            'proposal_id' => $proposalId,
            'requested_by' => $request->user()->id,
            'reason' => $validated['reason'],
            'requested_until' => $validated['requested_until'],
            'status' => 'pending',
        ]);

        AuditLogger::log('deadline_extension.requested', Proposal::class, $proposalId, $request->user()->id, null, [
            'tracker' => $proposal->tracker_number,
            'requested_until' => $validated['requested_until'],
        ]);

        $this->notifyOfficers($proposal, $request->user());

        return response()->json([
            'data' => $extension,
            'message' => 'Your extension request has been submitted. The RTT Office will review it and notify you.',
        ], 201);
    }

    /** Officer lists all extension requests. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('deadline_extensions.resolve')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Every request within the officer's scope, newest first; the page filters and counts them.
        $query = DeadlineExtensionRequest::with([
            'proposal:id,tracker_number,title,category,college_id,proposal_call_id,pi_user_id,academic_year,status,extended_deadline',
            'proposal.college:id,name',
            'proposal.proposalCall:id,title,end_date',
            'requestedBy:id,name,email',
            'resolvedBy:id,name',
        ])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at');
        $request->user()->accessScope()->constrainThrough($query, 'proposal');
        $extensions = $query->limit(500)->get();

        return response()->json([
            'data' => $extensions,
            'meta' => ['counts' => $extensions->countBy('status')],
        ]);
    }

    /** Officer grants or denies an extension request. */
    public function resolve(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('deadline_extensions.resolve')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'decision' => 'required|in:approved,denied',
            'resolution_notes' => 'required|string|min:10',
            'granted_until' => 'sometimes|date|after:now',
        ]);

        $extension = DeadlineExtensionRequest::with('proposal')->findOrFail($id);

        if (! $extension->proposal || ! $request->user()->accessScope()->covers($extension->proposal->college_id, $extension->proposal->category)) {
            return response()->json(['message' => 'This request is outside your area.'], 403);
        }

        if ($extension->status !== 'pending') {
            return response()->json(['message' => 'This extension request has already been resolved.'], 422);
        }

        $grantedUntil = $validated['decision'] === 'approved'
            ? ($validated['granted_until'] ?? $extension->requested_until)
            : null;

        DB::transaction(function () use ($extension, $validated, $request, $grantedUntil) {
            $extension->update([
                'status' => $validated['decision'],
                'resolved_by' => $request->user()->id,
                'resolution_notes' => $validated['resolution_notes'],
                'granted_until' => $grantedUntil,
                'resolved_at' => now(),
            ]);

            if ($validated['decision'] === 'approved') {
                $extension->proposal->update(['extended_deadline' => $grantedUntil]);
            }
        });

        $pi = $extension->proposal->pi;
        if ($pi) {
            $this->notifyPi($pi, $extension->proposal, $extension);
        }

        AuditLogger::log("deadline_extension.{$validated['decision']}", Proposal::class, $extension->proposal_id, $request->user()->id);

        return response()->json([
            'data' => $extension->fresh(),
            'message' => 'Extension request '.($validated['decision'] === 'approved' ? 'approved.' : 'denied.'),
        ]);
    }

    /** PI's own latest extension request for a proposal. */
    public function show(string $proposalId): JsonResponse
    {
        $extension = DeadlineExtensionRequest::where('proposal_id', $proposalId)
            ->latest()
            ->first();

        return response()->json(['data' => $extension]);
    }

    private function notifyOfficers(Proposal $proposal, User $submitter): void
    {
        // Everyone who may decide it: the central office and the programme's director.
        $officers = User::whoCan('deadline_extensions.resolve', $proposal->college_id, $proposal->category);
        foreach ($officers as $officer) {
            try {
                SendEmailNotificationJob::deliver($officer, 'deadline_extension_requested', [
                    'tracker_number' => $proposal->tracker_number,
                    'title' => $proposal->title,
                    'submitter_name' => $submitter->name,
                ]);
            } catch (\Exception $e) {
                Log::error("Deadline extension officer notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyPi(User $pi, Proposal $proposal, DeadlineExtensionRequest $extension): void
    {
        try {
            SendEmailNotificationJob::deliver($pi, 'deadline_extension_resolved', [
                'tracker_number' => $proposal->tracker_number,
                'title' => $proposal->title,
                'decision' => $extension->status,
                'resolution_notes' => $extension->resolution_notes,
                'granted_until' => $extension->granted_until?->format('d M Y, g:i A'),
            ]);
        } catch (\Exception $e) {
            Log::error("Deadline extension PI notify failed: {$e->getMessage()}");
        }
    }
}
