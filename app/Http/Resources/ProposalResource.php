<?php

namespace App\Http\Resources;

use App\Models\ProposalDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProposalResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $isOwner = $user && $user->id === $this->pi_user_id;
        // Blind review: who wrote a proposal stays hidden from anyone without the
        // "see author identities" permission (reviewers, college officers running
        // blind review); other documents and the PI CV likewise need their own
        // permissions. The PI always sees their own proposal in full.
        $hidePI = ! $isOwner && ! $user?->can('proposals.view_identity');
        $hideDocs = ! $isOwner && ! $user?->can('proposals.view_documents');
        $hideCv = ! $isOwner && ! $user?->can('proposals.view_cv');

        return [
            'id' => $this->id,
            'tracker_number' => $this->tracker_number,
            'title' => $this->title,
            'abstract' => $this->abstract,
            'keywords' => $this->keywords,
            'category' => $this->category,
            'status' => $this->status,
            'academic_year' => $this->academic_year,
            'proposal_call_id' => $this->proposal_call_id,
            'current_wizard_step' => $this->current_wizard_step,
            'wizard_completed_steps' => $this->wizard_completed_steps,
            'draft_data' => $this->draft_data,
            'submitted_at' => $this->submitted_at,
            'status_entered_at' => $this->status_entered_at,
            'ethical_clearance_required' => $this->ethical_clearance_required,
            'ethical_clearance_number' => $this->ethical_clearance_number,
            'ethical_clearance_status' => $this->ethical_clearance_status,
            'ethical_clearance_expiry' => $this->ethical_clearance_expiry,
            'ethical_clearance_submitted_at' => $this->ethical_clearance_submitted_at,
            'ethical_clearance_verified_at' => $this->ethical_clearance_verified_at,
            'ethical_clearance_rejection_reason' => $this->ethical_clearance_rejection_reason,
            'rejection_reason' => $this->rejection_reason,
            'anonymity_status' => $this->anonymity_status,
            'anonymity_findings' => $this->anonymity_findings,
            'anonymity_checked_at' => $this->anonymity_checked_at?->toIso8601String(),
            'review_disagreement' => $this->review_disagreement,
            'review_disagreement_flagged_at' => $this->review_disagreement_flagged_at?->toIso8601String(),
            'review_disagreement_resolved_at' => $this->review_disagreement_resolved_at?->toIso8601String(),
            'review_disagreement_note' => $this->review_disagreement_note,
            'rejected_at' => $this->rejected_at,
            'extended_deadline' => $this->extended_deadline,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,

            // PI identity — hidden from reviewers and college admins
            'pi_user_id' => $hidePI ? null : $this->pi_user_id,
            'pi_name' => $hidePI ? 'Anonymous Researcher' : ($this->whenLoaded('pi') ? $this->pi?->name : null),
            'pi' => $hidePI
                ? ['name' => 'Anonymous Researcher', 'email' => null]
                : ($this->whenLoaded('pi') ? ['id' => $this->pi?->id, 'name' => $this->pi?->name, 'email' => $this->pi?->email] : null),

            // College + department always visible
            'college_id' => $this->college_id,
            'college' => $this->whenLoaded('college', fn () => ['id' => $this->college?->id, 'name' => $this->college?->name]),
            'department_id' => $this->department_id,
            'department' => $this->whenLoaded('department', fn () => ['id' => $this->department?->id, 'name' => $this->department?->name]),

            // Team members and history — hidden from reviewers and college officers for blind integrity
            'members' => $hidePI ? [] : $this->whenLoaded('members'),
            'members_hidden' => $hidePI,
            'history_hidden' => $hidePI,
            'documents' => $this->whenLoaded('documents', function () use ($hideDocs, $hideCv) {
                if ($hideDocs) {
                    return $this->documents->whereIn('document_type', ProposalDocument::REVIEWER_VISIBLE_TYPES)->values();
                }

                if ($hideCv) {
                    return $this->documents->where('document_type', '!=', 'pi_cv')->values();
                }

                return $this->documents;
            }),
            'budgets' => $this->whenLoaded('budgets'),

            'proposal_call' => $this->whenLoaded('proposalCall', fn () => new ProposalCallResource($this->proposalCall)),
            'workflow_logs' => $this->whenLoaded('workflowLogs'),

            // Contract — only present for funded proposals
            'contract_status' => $this->contract_status,
            'contract_submitted_at' => $this->contract_submitted_at,
            'contract_signed_at' => $this->contract_signed_at,
            'contract_document_path' => $this->contract_document_path ? true : false,
            'contract_rejection_reason' => $this->contract_rejection_reason,

            // Award — only present for funded proposals
            'award' => $this->whenLoaded('award', fn () => $this->award ? [
                'grant_reference' => $this->award->grant_reference,
                'awarded_amount' => $this->award->awarded_amount,
                'approval_notes' => $this->award->approval_notes,
                'approved_at' => $this->award->approved_at?->toIso8601String(),
                'approved_by_name' => $this->award->approvedBy?->name,
                'grant_letter_ready' => (bool) $this->award->grant_letter_path,
            ] : null),
        ];
    }
}
