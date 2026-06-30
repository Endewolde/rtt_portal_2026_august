<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Complaint;
use App\Models\Proposal;
use App\Models\User;
use App\Services\ComplaintService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ComplaintController extends Controller
{
    public function __construct(private ComplaintService $service) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $level = $request->query('level'); // 'college' | 'officer' | null (all)

        $query = Complaint::with(['proposal:id,tracker_number,title,category,college_id', 'complainant:id,name']);

        if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
            // See all
        } elseif ($user->hasRole('college_officer')) {
            // Level 1 only — own college
            $query->where('level', 'college')
                ->whereHas('proposal', fn ($q) => $q->where('college_id', $user->college_id));
        } elseif ($user->hasAnyRole(['research_officer', 'community_officer', 'technology_officer'])) {
            // Level 2 only — own category
            $categoryMap = [
                'research_officer' => 'research',
                'community_officer' => 'community_engagement',
                'technology_officer' => 'technology_transfer',
            ];
            $category = collect($categoryMap)
                ->first(fn ($_, $role) => $user->hasRole($role));

            $query->where('level', 'officer')
                ->whereHas('proposal', fn ($q) => $q->where('category', $category));
        } else {
            // PI / staff / others — own complaints only
            $query->where('complainant_id', $user->id);
        }

        if ($level) {
            $query->where('level', $level);
        }

        return response()->json([
            'data' => $query->orderByDesc('created_at')->paginate(20),
        ]);
    }

    /**
     * File a Level 1 (college) complaint — blind_review or open_defence stage.
     */
    public function store(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'stage' => 'required|in:blind_review,open_defence',
            'description' => 'required|string|min:50',
        ]);

        $proposal = Proposal::findOrFail($id);
        $complaint = $this->service->fileCollegeComplaint(
            $proposal,
            $request->user(),
            $request->stage,
            $request->description
        );

        return response()->json(['data' => $complaint], 201);
    }

    /**
     * File a Level 2 (officer) complaint — post-funding, type = budget/rejection/other.
     */
    public function storeOfficerComplaint(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'complaint_type' => 'required|in:budget,rejection,other',
            'description' => 'required|string|min:50',
        ]);

        $proposal = Proposal::findOrFail($id);
        $complaint = $this->service->fileOfficerComplaint(
            $proposal,
            $request->user(),
            $request->complaint_type,
            $request->description
        );

        return response()->json(['data' => $complaint], 201);
    }

    /**
     * Escalate a Level 1 complaint to Level 2 officer review.
     */
    public function escalate(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'description' => 'required|string|min:30',
        ]);

        $complaint = Complaint::findOrFail($id);
        $escalated = $this->service->escalate($complaint, $request->user(), $request->description);

        return response()->json(['data' => $escalated], 201);
    }

    /**
     * Get all complaints for a specific proposal.
     * Officers see only their level; PI/members see all complaints on their own proposal.
     */
    public function proposalComplaints(string $id, Request $request): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        $user = $request->user();

        $query = Complaint::with(['complainant:id,name', 'resolvedBy:id,name'])
            ->where('proposal_id', $id);

        if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
            // See all levels
        } elseif ($user->hasRole('college_officer')) {
            $query->where('level', 'college');
        } elseif ($user->hasAnyRole(['research_officer', 'community_officer', 'technology_officer'])) {
            $query->where('level', 'officer');
        } else {
            // PI/staff — only if they own or are a member of the proposal
            $isMember = $proposal->pi_user_id === $user->id
                || $proposal->activeMembers()->where('user_id', $user->id)->exists();

            if (! $isMember) {
                return response()->json(['data' => []]);
            }
        }

        return response()->json([
            'data' => $query->orderByDesc('created_at')->get(),
        ]);
    }

    /**
     * Show a single complaint.
     * Access rules mirror the index scoping.
     */
    public function show(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $complaint = Complaint::with([
            'proposal:id,tracker_number,title,category,college_id',
            'complainant:id,name,email',
            'assignedTo:id,name',
            'resolvedBy:id,name',
            'escalatedFrom:id,stage,level,status',
        ])->findOrFail($id);

        $this->authorizeView($complaint, $user);

        return response()->json(['data' => $complaint]);
    }

    /**
     * Update a complaint's description.
     * Only the original complainant may edit, and only while the complaint is open.
     */
    public function update(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'description' => 'required|string|min:50',
        ]);

        $user = $request->user();
        $complaint = Complaint::findOrFail($id);

        if ($complaint->complainant_id !== $user->id && ! $user->hasAnyRole(['super_admin', 'central_officer'])) {
            return response()->json(['data' => null, 'message' => 'Only the complainant may edit this complaint.', 'errors' => [], 'meta' => []], 403);
        }

        if (! in_array($complaint->status, ['open', 'under_review'])) {
            return response()->json(['data' => null, 'message' => 'Only open complaints can be edited.', 'errors' => [], 'meta' => []], 422);
        }

        $complaint->update(['description' => $request->description]);

        return response()->json(['data' => $complaint->fresh()]);
    }

    /**
     * Withdraw (delete) an open complaint.
     * Only the complainant or an admin may withdraw; complaint must be open.
     */
    public function destroy(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $complaint = Complaint::findOrFail($id);

        if ($complaint->complainant_id !== $user->id && ! $user->hasAnyRole(['super_admin', 'central_officer'])) {
            return response()->json(['data' => null, 'message' => 'Only the complainant may withdraw this complaint.', 'errors' => [], 'meta' => []], 403);
        }

        if ($complaint->status !== 'open') {
            return response()->json(['data' => null, 'message' => 'Only open complaints can be withdrawn.', 'errors' => [], 'meta' => []], 422);
        }

        $complaint->delete();

        return response()->json(['data' => null, 'message' => 'Complaint withdrawn successfully.'], 200);
    }

    public function respond(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'response' => 'required|string',
            'resolution' => 'required|in:resolved,dismissed',
        ]);

        $complaint = Complaint::findOrFail($id);
        $resolved = $this->service->respond(
            $complaint,
            $request->user(),
            $request->response,
            $request->resolution
        );

        return response()->json(['data' => $resolved]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authorizeView(Complaint $complaint, User $user): void
    {
        if ($user->hasAnyRole(['super_admin', 'central_officer'])) {
            return;
        }

        if ($user->hasRole('college_officer') || $user->hasRole('college_officer')) {
            abort_unless(
                $complaint->level === 'college'
                && optional($complaint->proposal)->college_id === $user->college_id,
                403
            );

            return;
        }

        $categoryMap = [
            'research_officer' => 'research',
            'community_officer' => 'community_engagement',
            'technology_officer' => 'technology_transfer',
        ];
        if ($user->hasAnyRole(array_keys($categoryMap))) {
            $category = collect($categoryMap)->first(fn ($_, $role) => $user->hasRole($role));
            abort_unless(
                $complaint->level === 'officer'
                && optional($complaint->proposal)->category === $category,
                403
            );

            return;
        }

        // PI / staff — own complaint only
        abort_unless($complaint->complainant_id === $user->id, 403);
    }
}
