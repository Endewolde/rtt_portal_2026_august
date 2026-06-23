<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProposalResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $isOwner = $user && $user->id === $this->pi_user_id;
        $isReviewer = $user && $user->hasRole('staff');
        $isColAdmin = $user && $user->hasRole('college_officer');
        $hidePI = ! $isOwner && ($isReviewer || $isColAdmin);

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
            'rejection_reason' => $this->rejection_reason,
            'rejected_at' => $this->rejected_at,
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
            'documents' => $this->whenLoaded('documents'),
            'budgets' => $this->whenLoaded('budgets'),

            'proposal_call' => $this->whenLoaded('proposalCall', fn () => new ProposalCallResource($this->proposalCall)),
            'workflow_logs' => $this->whenLoaded('workflowLogs'),

            // Award — only present for funded proposals
            'award' => $this->whenLoaded('award', fn () => $this->award ? [
                'grant_reference' => $this->award->grant_reference,
                'awarded_amount' => $this->award->awarded_amount,
                'approval_notes' => $this->award->approval_notes,
                'approved_at' => $this->award->approved_at?->toIso8601String(),
                'approved_by_name' => $this->award->approvedBy?->name,
            ] : null),
        ];
    }
}
