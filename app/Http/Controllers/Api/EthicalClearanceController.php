<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailNotificationJob;
use App\Models\Proposal;
use App\Models\ProposalDocument;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\RejectionReasons;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EthicalClearanceController extends Controller
{
    private const OFFICER_ROLES = ['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer', 'college_officer'];

    /** PI submits their uploaded certificate's details for officer verification. */
    public function submit(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clearance_number' => 'required|string|max:100',
            'expiry_date' => 'required|date|after:today',
        ]);

        $proposal = Proposal::findOrFail($id);

        if ($proposal->pi_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (! $proposal->ethical_clearance_required) {
            return response()->json(['message' => 'This proposal is not flagged as requiring ethical clearance.'], 422);
        }

        if ($proposal->ethical_clearance_status === 'submitted') {
            return response()->json(['message' => 'Your certificate is already awaiting review.'], 422);
        }

        $hasCertificate = ProposalDocument::where('proposal_id', $id)
            ->where('document_type', 'ethical_clearance_certificate')
            ->where('is_current', true)
            ->exists();

        if (! $hasCertificate) {
            return response()->json(['message' => 'Please upload your ethical clearance certificate (in the Documents tab) before submitting.'], 422);
        }

        $proposal->update([
            'ethical_clearance_number' => $validated['clearance_number'],
            'ethical_clearance_expiry' => $validated['expiry_date'],
            'ethical_clearance_status' => 'submitted',
            'ethical_clearance_submitted_at' => now(),
            'ethical_clearance_verified_by' => null,
            'ethical_clearance_verified_at' => null,
            'ethical_clearance_rejection_reason' => null,
        ]);

        AuditLogger::log('ethical_clearance.submitted', Proposal::class, $id, $request->user()->id, null, [
            'tracker' => $proposal->tracker_number,
            'clearance_number' => $validated['clearance_number'],
        ]);

        $this->notifyOfficers($proposal, $request->user());

        return response()->json([
            'data' => $proposal->fresh(),
            'message' => 'Certificate submitted for verification.',
        ]);
    }

    /** Officer dashboard: proposals that require ethical clearance, scoped like the rest of the app. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(self::OFFICER_ROLES)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $query = Proposal::query()
            ->whereNull('deleted_at')
            ->where('ethical_clearance_required', true)
            ->with([
                'pi:id,name,email', 'college:id,name', 'ethicalClearanceVerifiedBy:id,name',
                'documents' => fn ($q) => $q->where('document_type', 'ethical_clearance_certificate')->where('is_current', true),
            ]);

        if ($request->_category_scope) {
            $query->where('category', $request->_category_scope);
        } elseif ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->_college_scope) {
            $query->where('college_id', $request->_college_scope);
        } elseif ($request->filled('college_id')) {
            $query->where('college_id', $request->college_id);
        }

        if ($request->filled('status')) {
            $query->where('ethical_clearance_status', $request->status);
        }

        $proposals = $query->orderByRaw("ethical_clearance_status = 'submitted' desc")
            ->orderBy('ethical_clearance_expiry')
            ->paginate(20);

        return response()->json(['data' => $proposals]);
    }

    /** Officer approves a submitted certificate. */
    public function approve(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(self::OFFICER_ROLES)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $proposal = Proposal::findOrFail($id);

        if ($proposal->ethical_clearance_status !== 'submitted') {
            return response()->json(['message' => 'No certificate is currently awaiting review for this proposal.'], 422);
        }

        $proposal->update([
            'ethical_clearance_status' => 'approved',
            'ethical_clearance_verified_by' => $request->user()->id,
            'ethical_clearance_verified_at' => now(),
        ]);

        AuditLogger::log('ethical_clearance.approved', Proposal::class, $id, $request->user()->id);
        $this->notifyPi($proposal, 'approved');

        return response()->json(['data' => $proposal->fresh(), 'message' => 'Ethical clearance approved.']);
    }

    /** Officer rejects a submitted certificate, returning it to the PI for correction. */
    public function reject(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->hasAnyRole(self::OFFICER_ROLES)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        RejectionReasons::apply($request, 'ethical_clearance');
        $validated = $request->validate(['reason' => 'required|string|min:10']);

        $proposal = Proposal::findOrFail($id);

        if ($proposal->ethical_clearance_status !== 'submitted') {
            return response()->json(['message' => 'No certificate is currently awaiting review for this proposal.'], 422);
        }

        $proposal->update([
            'ethical_clearance_status' => 'rejected',
            'ethical_clearance_verified_by' => $request->user()->id,
            'ethical_clearance_verified_at' => now(),
            'ethical_clearance_rejection_reason' => $validated['reason'],
        ]);

        AuditLogger::log('ethical_clearance.rejected', Proposal::class, $id, $request->user()->id);
        $this->notifyPi($proposal, 'rejected', $validated['reason']);

        return response()->json(['data' => $proposal->fresh(), 'message' => 'Certificate returned to PI for correction.']);
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
                SendEmailNotificationJob::deliver($officer, 'ethical_clearance_submitted', [
                    'tracker_number' => $proposal->tracker_number,
                    'title' => $proposal->title,
                    'submitter_name' => $submitter->name,
                ]);
            } catch (\Exception $e) {
                Log::error("Ethical clearance officer notify failed: {$e->getMessage()}");
            }
        }
    }

    private function notifyPi(Proposal $proposal, string $decision, ?string $reason = null): void
    {
        $pi = $proposal->pi ?? User::find($proposal->pi_user_id);
        if (! $pi) {
            return;
        }

        try {
            SendEmailNotificationJob::deliver($pi, 'ethical_clearance_resolved', [
                'tracker_number' => $proposal->tracker_number,
                'title' => $proposal->title,
                'decision' => $decision,
                'reason' => $reason,
            ]);
        } catch (\Exception $e) {
            Log::error("Ethical clearance PI notify failed: {$e->getMessage()}");
        }
    }
}
