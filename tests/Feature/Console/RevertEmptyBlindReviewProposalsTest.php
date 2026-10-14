<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function rebr_makeProposal(string $status): Proposal
{
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'RE'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RED'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 're-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $superAdmin->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'RE-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

test('dry run reports a proposal stuck under_blind_review with zero reviewers but does not change it', function () {
    $proposal = rebr_makeProposal('under_blind_review');

    Artisan::call('reviews:revert-empty-blind-review');
    $output = Artisan::output();

    expect($output)->toContain($proposal->tracker_number)
        ->toContain('would revert to validated')
        ->toContain('DRY RUN');
    expect(Proposal::find($proposal->id)->status)->toBe('under_blind_review');
});

test('--force reverts a stuck proposal back to validated', function () {
    $proposal = rebr_makeProposal('under_blind_review');

    Artisan::call('reviews:revert-empty-blind-review', ['--force' => true]);

    expect(Proposal::find($proposal->id)->status)->toBe('validated');
    $this->assertDatabaseHas('workflow_logs', [
        'proposal_id' => $proposal->id, 'from_stage' => 'under_blind_review',
        'action' => 'unassign_reviewers', 'to_stage' => 'validated',
    ]);
});

test('a proposal under_blind_review with an active reviewer is left alone', function () {
    $proposal = rebr_makeProposal('under_blind_review');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = EvaluationType::create(['name' => 'rebr_type', 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $proposal->created_by,
        'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->addDays(7),
    ]);

    Artisan::call('reviews:revert-empty-blind-review', ['--force' => true]);

    expect(Proposal::find($proposal->id)->status)->toBe('under_blind_review');
});

test('a proposal in a different status entirely is not touched', function () {
    $proposal = rebr_makeProposal('validated');

    Artisan::call('reviews:revert-empty-blind-review', ['--force' => true]);

    expect(Proposal::find($proposal->id)->status)->toBe('validated');
});

test('reports nothing to do when there are no stuck proposals', function () {
    Artisan::call('reviews:revert-empty-blind-review');
    expect(Artisan::output())->toContain('nothing to do');
});
