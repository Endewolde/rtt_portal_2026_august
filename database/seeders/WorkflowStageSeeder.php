<?php

namespace Database\Seeders;

use App\Models\WorkflowAction;
use App\Models\WorkflowStage;
use App\Models\WorkflowTransition;
use Illuminate\Database\Seeder;

class WorkflowStageSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedStages();
        $this->seedActions();
        $this->seedTransitions();
    }

    private function seedStages(): void
    {
        $stages = [
            ['name' => 'draft',               'label' => 'Draft',               'is_terminal' => false, 'order_index' => 1],
            ['name' => 'submitted',            'label' => 'Submitted',           'is_terminal' => false, 'order_index' => 2],
            ['name' => 'validated',            'label' => 'Validated',           'is_terminal' => false, 'order_index' => 3],
            ['name' => 'under_blind_review',   'label' => 'Under Blind Review',  'is_terminal' => false, 'order_index' => 4],
            ['name' => 'blind_review_passed',  'label' => 'Blind Review Passed', 'is_terminal' => false, 'order_index' => 5],
            ['name' => 'under_open_defence',   'label' => 'Under Open Defence',  'is_terminal' => false, 'order_index' => 6],
            ['name' => 'accepted',             'label' => 'Accepted',            'is_terminal' => false, 'order_index' => 7],
            ['name' => 'funded',               'label' => 'Funded',              'is_terminal' => false, 'order_index' => 8],
            ['name' => 'midterm_evaluation',   'label' => 'Midterm Evaluation',  'is_terminal' => false, 'order_index' => 9],
            ['name' => 'completed',            'label' => 'Completed',           'is_terminal' => false, 'order_index' => 10],
            ['name' => 'archived',             'label' => 'Archived',            'is_terminal' => true,  'order_index' => 11],
            ['name' => 'rejected',             'label' => 'Rejected',            'is_terminal' => true,  'order_index' => 12],
        ];

        foreach ($stages as $stage) {
            WorkflowStage::updateOrCreate(['name' => $stage['name']], $stage);
        }
    }

    private function seedActions(): void
    {
        $actions = [
            'submit',
            'validate',
            'return_for_correction',
            'reject',
            'assign_for_review',
            'unassign_reviewers',
            'return_for_investigation',
            'withdraw_report_resume_review',
            'withdraw_report_restore_passed',
            'reopen',
            'pass_blind_review',
            'fail_blind_review',
            'schedule_defence',
            'pass_defence',
            'fail_defence',
            'accept',
            'central_approve',
            'central_reject',
            'fund',
            'revoke_funding',
            'start_midterm',
            'complete',
            'archive',
        ];

        foreach ($actions as $name) {
            $label = ucwords(str_replace('_', ' ', $name));
            WorkflowAction::updateOrCreate(['name' => $name], [
                'name' => $name,
                'label' => $label,
            ]);
        }
    }

    private function seedTransitions(): void
    {
        $officers = ['research_officer', 'community_officer', 'technology_officer'];
        $allOfficers = [...$officers, 'college_officer'];
        $adminCore = ['central_officer', 'super_admin'];
        $adminFull = [...$adminCore, ...$officers];
        $adminWithCol = [...$adminCore, 'college_officer', ...$officers];

        $transitions = [
            ['from' => 'draft',              'action' => 'submit',                'to' => 'submitted',           'roles' => ['pi', 'super_admin', 'central_officer', 'staff']],
            ['from' => 'submitted',          'action' => 'validate',              'to' => 'validated',           'roles' => $adminFull],
            ['from' => 'submitted',          'action' => 'return_for_correction', 'to' => 'draft',               'roles' => $adminFull],
            ['from' => 'submitted',          'action' => 'reject',                'to' => 'rejected',            'roles' => $adminFull],
            ['from' => 'validated',          'action' => 'assign_for_review',     'to' => 'under_blind_review',  'roles' => $adminWithCol],
            // A category/central officer can reject straight from validated — most
            // notably this is the landing spot after a college officer's "mistaken
            // approval" report pulls a proposal back out of blind review (see
            // return_for_investigation below), so the officer needs a real way to
            // act on it here, not just re-assign reviewers.
            ['from' => 'validated',          'action' => 'reject',                'to' => 'rejected',            'roles' => $adminFull],
            // Symmetric reverse of assign_for_review — fired when the last active
            // reviewer is removed from a proposal that hasn't been scored yet, so the
            // proposal doesn't get stuck at under_blind_review with nothing to review
            // it and no way to re-open the Assign Reviewers UI (which only shows for
            // status=validated).
            ['from' => 'under_blind_review', 'action' => 'unassign_reviewers',    'to' => 'validated',           'roles' => $adminWithCol],
            // Fired when a college officer reports a proposal as possibly mistakenly
            // approved (ProposalApprovalReportController::store) — pulls it back to
            // validated so the category/central officer can decide the next action.
            ['from' => 'under_blind_review', 'action' => 'return_for_investigation', 'to' => 'validated',        'roles' => $adminWithCol],
            ['from' => 'blind_review_passed', 'action' => 'return_for_investigation', 'to' => 'validated',       'roles' => $adminWithCol],
            // The college officer withdraws their mistaken-approval report before it
            // was acted on — the proposal goes back to the stage the report pulled it
            // from (see ProposalApprovalReportController::withdraw).
            ['from' => 'validated', 'action' => 'withdraw_report_resume_review',  'to' => 'under_blind_review',  'roles' => $adminWithCol],
            ['from' => 'validated', 'action' => 'withdraw_report_restore_passed', 'to' => 'blind_review_passed', 'roles' => $adminWithCol],
            ['from' => 'under_blind_review', 'action' => 'pass_blind_review',     'to' => 'blind_review_passed', 'roles' => $adminFull],
            ['from' => 'under_blind_review', 'action' => 'fail_blind_review',     'to' => 'rejected',            'roles' => $adminFull],
            // Same action, a second edge: lets an admin-tier actor (or the
            // reviews:correct-blind-review command) correct a proposal that was
            // already auto-passed but shouldn't have been — without a status guard
            // hack outside WorkflowService, which is the only place proposal.status
            // is allowed to change.
            ['from' => 'blind_review_passed', 'action' => 'fail_blind_review',     'to' => 'rejected',            'roles' => $adminFull],
            ['from' => 'blind_review_passed', 'action' => 'schedule_defence',      'to' => 'under_open_defence',  'roles' => $adminWithCol],
            ['from' => 'under_open_defence', 'action' => 'pass_defence',          'to' => 'accepted',            'roles' => $adminFull],
            ['from' => 'under_open_defence', 'action' => 'fail_defence',          'to' => 'rejected',            'roles' => $adminFull],
            // Same action, a second edge — same reasoning as blind_review_passed's
            // second fail_blind_review edge above: lets ReviewScoreService::
            // recalculateAllDecisions correct a proposal that was auto-accepted but
            // shouldn't have been, while it's still sitting at accepted (not yet
            // funded, so nothing downstream depends on it).
            ['from' => 'accepted',           'action' => 'fail_defence',          'to' => 'rejected',            'roles' => $adminFull],
            ['from' => 'accepted',           'action' => 'central_approve',       'to' => 'funded',              'roles' => [...$adminFull, 'college_rtt_manager']],
            ['from' => 'accepted',           'action' => 'central_reject',        'to' => 'rejected',            'roles' => [...$adminFull, 'college_rtt_manager']],
            ['from' => 'accepted',           'action' => 'fund',                  'to' => 'funded',              'roles' => [...$adminFull, 'college_rtt_manager']],
            ['from' => 'funded',             'action' => 'revoke_funding',        'to' => 'rejected',            'roles' => [...$adminCore, 'college_rtt_manager']],
            ['from' => 'funded',             'action' => 'start_midterm',         'to' => 'midterm_evaluation',  'roles' => $adminWithCol],
            ['from' => 'midterm_evaluation', 'action' => 'complete',              'to' => 'completed',           'roles' => $adminWithCol],
            ['from' => 'completed',          'action' => 'archive',               'to' => 'archived',            'roles' => $adminCore],
        ];

        foreach ($transitions as $t) {
            $fromStage = WorkflowStage::where('name', $t['from'])->firstOrFail();
            $action = WorkflowAction::where('name', $t['action'])->firstOrFail();
            $toStage = WorkflowStage::where('name', $t['to'])->firstOrFail();

            WorkflowTransition::updateOrCreate(
                ['from_stage_id' => $fromStage->id, 'action_id' => $action->id],
                [
                    'to_stage_id' => $toStage->id,
                    'allowed_roles' => $t['roles'],
                ]
            );
        }
    }
}
