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
            'pass_blind_review',
            'fail_blind_review',
            'schedule_defence',
            'pass_defence',
            'fail_defence',
            'accept',
            'central_approve',
            'central_reject',
            'fund',
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
            // Symmetric reverse of assign_for_review — fired when the last active
            // reviewer is removed from a proposal that hasn't been scored yet, so the
            // proposal doesn't get stuck at under_blind_review with nothing to review
            // it and no way to re-open the Assign Reviewers UI (which only shows for
            // status=validated).
            ['from' => 'under_blind_review', 'action' => 'unassign_reviewers',    'to' => 'validated',           'roles' => $adminWithCol],
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
            ['from' => 'accepted',           'action' => 'central_approve',       'to' => 'funded',              'roles' => $adminFull],
            ['from' => 'accepted',           'action' => 'central_reject',        'to' => 'rejected',            'roles' => $adminFull],
            ['from' => 'accepted',           'action' => 'fund',                  'to' => 'funded',              'roles' => $adminFull],
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
