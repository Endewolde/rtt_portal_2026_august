<?php

namespace App\Services;

use App\Exceptions\ComplaintAlreadyFiledException;
use App\Exceptions\UnauthorizedResolutionException;
use App\Models\Complaint;
use App\Models\Proposal;
use App\Models\User;

class ComplaintService
{
    // Proposal statuses that qualify for Level 2 (post-funding) complaints
    private const FUNDED_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    // Category → officer role mapping for Level 2 routing
    private const CATEGORY_OFFICER = [
        'research' => 'research_officer',
        'community_engagement' => 'community_officer',
        'technology_transfer' => 'technology_officer',
    ];

    public function __construct(
        private NotificationService $notificationService
    ) {}

    /**
     * File a Level 1 (college-level) complaint for blind_review or open_defence.
     * Routed to the college_officer of the proposal's college.
     *
     * @throws ComplaintAlreadyFiledException
     * @throws \InvalidArgumentException
     */
    public function fileCollegeComplaint(
        Proposal $proposal,
        User $complainant,
        string $stage,
        string $description
    ): Complaint {
        if (! in_array($stage, ['blind_review', 'open_defence'])) {
            throw new \InvalidArgumentException('Level 1 complaints only accept blind_review or open_defence stages.');
        }

        if (strlen($description) < 50) {
            throw new \InvalidArgumentException('Complaint description must be at least 50 characters.');
        }

        $this->guardDuplicate($proposal->id, $stage, 'college');

        $assignedTo = User::role('college_officer')
            ->where('college_id', $proposal->college_id)
            ->first()
            // fall back to college_officer if no officer assigned yet
            ?? User::role('college_officer')
                ->where('college_id', $proposal->college_id)
                ->first();

        $complaint = Complaint::create([
            'proposal_id' => $proposal->id,
            'complainant_id' => $complainant->id,
            'stage' => $stage,
            'level' => 'college',
            'description' => $description,
            'status' => 'open',
            'assigned_to' => $assignedTo?->id,
        ]);

        $this->notifyAssignee($assignedTo, $proposal, $complainant, $stage);

        return $complaint->fresh();
    }

    /**
     * File a Level 2 (officer-level) complaint for a funded proposal.
     * Routed to the category officer matching the proposal's category.
     *
     * @throws ComplaintAlreadyFiledException
     * @throws \InvalidArgumentException
     */
    public function fileOfficerComplaint(
        Proposal $proposal,
        User $complainant,
        string $complaintType,
        string $description
    ): Complaint {
        if (! in_array($proposal->status, self::FUNDED_STATUSES)) {
            throw new \InvalidArgumentException('Officer-level complaints can only be filed for funded proposals.');
        }

        if (! in_array($complaintType, ['budget', 'rejection', 'other'])) {
            throw new \InvalidArgumentException("Invalid complaint type: {$complaintType}");
        }

        $this->guardDuplicate($proposal->id, $complaintType, 'officer');

        $assignedTo = $this->routeToOfficer($proposal);

        $complaint = Complaint::create([
            'proposal_id' => $proposal->id,
            'complainant_id' => $complainant->id,
            'stage' => 'post_funding',
            'level' => 'officer',
            'complaint_type' => $complaintType,
            'description' => $description,
            'status' => 'open',
            'assigned_to' => $assignedTo?->id,
        ]);

        $this->notifyAssignee($assignedTo, $proposal, $complainant, $complaintType);

        return $complaint->fresh();
    }

    /**
     * Escalate a Level 1 complaint to Level 2.
     * Creates a new officer-level complaint referencing the original.
     */
    public function escalate(
        Complaint $original,
        User $complainant,
        string $description
    ): Complaint {
        if ($original->level !== 'college') {
            throw new \InvalidArgumentException('Only Level 1 (college) complaints can be escalated.');
        }

        if ($original->complainant_id !== $complainant->id) {
            throw new \InvalidArgumentException('Only the original complainant can escalate a complaint.');
        }

        $proposal = $original->proposal;
        $assignedTo = $this->routeToOfficer($proposal);

        $escalated = Complaint::create([
            'proposal_id' => $proposal->id,
            'complainant_id' => $complainant->id,
            'stage' => $original->stage,
            'level' => 'officer',
            'complaint_type' => 'escalation',
            'escalated_from_id' => $original->id,
            'description' => $description,
            'status' => 'open',
            'assigned_to' => $assignedTo?->id,
        ]);

        // Mark the original as escalated
        $original->update(['status' => 'escalated']);

        $this->notifyAssignee($assignedTo, $proposal, $complainant, 'escalated complaint');

        return $escalated->fresh();
    }

    /**
     * Respond to and resolve a complaint.
     *
     * @throws UnauthorizedResolutionException
     */
    public function respond(
        Complaint $complaint,
        User $responder,
        string $response,
        string $resolution
    ): Complaint {
        // College officers can only resolve Level 1 complaints for their college
        if ($responder->hasRole('college_officer')) {
            $proposal = $complaint->proposal ?? Proposal::find($complaint->proposal_id);
            if ($complaint->level !== 'college' || $proposal?->college_id !== $responder->college_id) {
                throw new UnauthorizedResolutionException('You can only respond to college-level complaints for your own college.');
            }
        }

        // Category officers can only resolve Level 2 complaints for their category
        $categoryOfficers = ['research_officer', 'community_officer', 'technology_officer'];
        if ($responder->hasAnyRole($categoryOfficers)) {
            if ($complaint->level !== 'officer') {
                throw new UnauthorizedResolutionException('You can only respond to officer-level complaints.');
            }
        }

        $complaint->update([
            'status' => $resolution,
            'response' => $response,
            'resolved_by' => $responder->id,
            'resolved_at' => now(),
        ]);

        $complainant = User::find($complaint->complainant_id);
        if ($complainant) {
            $this->notificationService->send('complaint_response', $complainant, [
                'proposal_id' => $complaint->proposal_id,
                'tracker_number' => $complaint->proposal?->tracker_number,
                'response' => $response,
                'resolved_by' => $responder->name,
                'resolution' => $resolution,
            ]);
        }

        return $complaint->fresh();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function guardDuplicate(string $proposalId, string $identifier, string $level): void
    {
        $field = $level === 'officer' ? 'complaint_type' : 'stage';

        $exists = Complaint::where('proposal_id', $proposalId)
            ->where('level', $level)
            ->where($field, $identifier)
            ->whereIn('status', ['open', 'under_review'])
            ->exists();

        if ($exists) {
            throw new ComplaintAlreadyFiledException(
                "An open {$level}-level complaint already exists for this proposal ({$identifier})."
            );
        }
    }

    private function routeToOfficer(Proposal $proposal): ?User
    {
        $role = self::CATEGORY_OFFICER[$proposal->category] ?? null;

        if ($role) {
            return User::role($role)
                ->withCount(['assignedComplaints' => fn ($q) => $q->whereIn('status', ['open', 'under_review'])])
                ->orderBy('assigned_complaints_count', 'asc')
                ->first();
        }

        // innovation / other → central_officer
        return User::role('central_officer')
            ->withCount(['assignedComplaints' => fn ($q) => $q->whereIn('status', ['open', 'under_review'])])
            ->orderBy('assigned_complaints_count', 'asc')
            ->first();
    }

    private function notifyAssignee(?User $assignedTo, Proposal $proposal, User $complainant, string $stage): void
    {
        if (! $assignedTo) {
            return;
        }

        $this->notificationService->send('complaint_filed', $assignedTo, [
            'proposal_id' => $proposal->id,
            'tracker_number' => $proposal->tracker_number,
            'stage' => $stage,
            'complainant' => $complainant->name,
        ]);
    }

    /**
     * Legacy method kept for backward compatibility with any direct calls.
     */
    public function file(Proposal $proposal, User $complainant, string $stage, string $description): Complaint
    {
        if (in_array($stage, ['blind_review', 'open_defence'])) {
            return $this->fileCollegeComplaint($proposal, $complainant, $stage, $description);
        }

        if ($stage === 'final_decision' || $stage === 'validation') {
            return $this->fileCentralComplaint($proposal, $complainant, $stage, $description);
        }

        return $this->fileOfficerComplaint($proposal, $complainant, $stage, $description);
    }

    public function fileCentralComplaint(
        Proposal $proposal,
        User $complainant,
        string $stage,
        string $description
    ): Complaint {
        if (strlen($description) < 50) {
            throw new \InvalidArgumentException('Complaint description must be at least 50 characters.');
        }

        $this->guardDuplicate($proposal->id, $stage, 'central');

        $assignedTo = User::role('central_officer')->first();

        $complaint = Complaint::create([
            'proposal_id' => $proposal->id,
            'complainant_id' => $complainant->id,
            'stage' => $stage,
            'level' => 'central',
            'description' => $description,
            'status' => 'open',
            'assigned_to' => $assignedTo?->id,
        ]);

        $this->notifyAssignee($assignedTo, $proposal, $complainant, $stage);

        return $complaint->fresh();
    }
}
