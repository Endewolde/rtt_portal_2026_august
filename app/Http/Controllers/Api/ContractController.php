<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\Proposal;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ContractController extends Controller
{
    /**
     * PI submits the signed contract PDF for officer review.
     */
    public function submit(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::findOrFail($id);

        if ($proposal->pi_user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized.', 'errors' => []], 403);
        }

        if (! in_array($proposal->status, ['funded', 'midterm_evaluation'])) {
            return response()->json([
                'data' => null,
                'message' => 'Contract can only be submitted for funded proposals.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        if ($proposal->contract_status === 'approved') {
            return response()->json([
                'data' => null,
                'message' => 'Contract has already been approved.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $request->validate(['file' => 'required|file|mimes:pdf|max:20480']);

        // Remove old document if re-submitting after rejection
        if ($proposal->contract_document_path) {
            Storage::disk('private')->delete($proposal->contract_document_path);
        }

        $path = $request->file('file')->store("contracts/{$id}", 'private');

        $proposal->update([
            'contract_document_path' => $path,
            'contract_status' => 'pending',
            'contract_submitted_at' => now(),
            'contract_submitted_by' => $user->id,
            'contract_rejection_reason' => null,
        ]);

        $this->notifyOfficersOfSubmission($proposal);

        return response()->json([
            'data' => [
                'contract_status' => $proposal->contract_status,
                'contract_submitted_at' => $proposal->contract_submitted_at,
            ],
            'message' => 'Contract submitted for review. An officer will review and approve it shortly.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Officer approves the PI-submitted contract.
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'college_officer',
            'research_officer', 'community_officer', 'technology_officer', 'support_officer'])) {
            return response()->json(['message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $proposal = Proposal::with('pi')->findOrFail($id);

        if ($proposal->contract_status !== 'pending') {
            return response()->json([
                'data' => null,
                'message' => 'No pending contract submission to approve.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $proposal->update([
            'contract_status' => 'approved',
            'contract_signed_at' => now(),
            'contract_signed_by' => $user->id,
            'contract_rejection_reason' => null,
        ]);

        $this->notifyPiOfApproval($proposal);

        return response()->json([
            'data' => $proposal->only(['id', 'tracker_number', 'contract_status', 'contract_signed_at']),
            'message' => 'Contract approved. The PI may now submit their first budget request.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Officer rejects the PI-submitted contract with a reason.
     */
    public function reject(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'college_officer',
            'research_officer', 'community_officer', 'technology_officer', 'support_officer'])) {
            return response()->json(['message' => 'Unauthorized.', 'errors' => []], 403);
        }

        $proposal = Proposal::with('pi')->findOrFail($id);

        if ($proposal->contract_status !== 'pending') {
            return response()->json([
                'data' => null,
                'message' => 'No pending contract submission to reject.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        $request->validate(['reason' => 'required|string|max:1000']);

        $proposal->update([
            'contract_status' => 'rejected',
            'contract_rejection_reason' => $request->input('reason'),
        ]);

        $this->notifyPiOfRejection($proposal);

        return response()->json([
            'data' => $proposal->only(['id', 'tracker_number', 'contract_status', 'contract_rejection_reason']),
            'message' => 'Contract rejected. The PI has been notified to resubmit.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * PI removes their submitted contract (only when pending or rejected).
     */
    public function remove(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $proposal = Proposal::findOrFail($id);

        if ($proposal->pi_user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized.', 'errors' => []], 403);
        }

        if ($proposal->contract_status === 'approved') {
            return response()->json([
                'data' => null,
                'message' => 'An approved contract cannot be removed.',
                'errors' => [],
                'meta' => [],
            ], 422);
        }

        if ($proposal->contract_document_path) {
            Storage::disk('private')->delete($proposal->contract_document_path);
        }

        $proposal->update([
            'contract_document_path' => null,
            'contract_status' => null,
            'contract_submitted_at' => null,
            'contract_submitted_by' => null,
            'contract_rejection_reason' => null,
        ]);

        return response()->json([
            'data' => null,
            'message' => 'Contract removed. You can upload a new one when ready.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * Download the signed contract PDF — the proposal's own PI, or an officer role
     * (same set that can approve/reject contracts above).
     */
    public function download(Request $request, string $id)
    {
        $user = $request->user();
        $proposal = Proposal::findOrFail($id);

        $isOwner = $user && $proposal->pi_user_id === $user->id;

        if (! $isOwner && ! $user?->can('contracts.download')) {
            abort(403, 'Unauthorized.');
        }

        if (! $proposal->contract_document_path) {
            abort(404, 'No contract document uploaded.');
        }

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('private');

        if (! $disk->exists($proposal->contract_document_path)) {
            abort(404, 'Contract file not found.');
        }

        return $disk->download(
            $proposal->contract_document_path,
            'contract-'.$proposal->tracker_number.'.pdf'
        );
    }

    private function notifyOfficersOfSubmission(Proposal $proposal): void
    {
        $officers = User::role([
            'super_admin', 'admin', 'central_officer',
            'research_officer', 'community_officer', 'technology_officer',
        ])->where('status', 'active')->get();

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'pi_name' => $proposal->pi?->name ?? 'Unknown',
        ];

        foreach ($officers as $officer) {
            try {
                SendEmailNotificationJob::dispatchSync($officer, 'contract_submitted', $data);
                StoreInAppNotificationJob::dispatchSync($officer->id, 'contract_submitted', $data);
            } catch (\Exception $e) {
                Log::error("Contract submission notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyPiOfApproval(Proposal $proposal): void
    {
        $pi = $proposal->pi;
        if (! $pi) {
            return;
        }

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
        ];

        try {
            SendEmailNotificationJob::dispatchSync($pi, 'contract_approved', $data);
            StoreInAppNotificationJob::dispatchSync($pi->id, 'contract_approved', $data);
        } catch (\Exception $e) {
            Log::error("Contract approval notify failed: {$e->getMessage()}");
        }
    }

    private function notifyPiOfRejection(Proposal $proposal): void
    {
        $pi = $proposal->pi;
        if (! $pi) {
            return;
        }

        $data = [
            'tracker_number' => $proposal->tracker_number,
            'title' => $proposal->title,
            'reason' => $proposal->contract_rejection_reason,
        ];

        try {
            SendEmailNotificationJob::dispatchSync($pi, 'contract_rejected', $data);
            StoreInAppNotificationJob::dispatchSync($pi->id, 'contract_rejected', $data);
        } catch (\Exception $e) {
            Log::error("Contract rejection notify failed: {$e->getMessage()}");
        }
    }
}
