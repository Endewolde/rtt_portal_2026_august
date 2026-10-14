<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Services\WorkflowService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function crar_makeProposal(string $status): array
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'CR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CRD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'cr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'CR-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $central];
}

function crar_assign(Proposal $proposal, string $prefix, string $status): ReviewAssignment
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = EvaluationType::create(['name' => $prefix.'_'.Str::random(6), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);

    return ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $proposal->created_by,
        'status' => $status, 'assigned_at' => now(),
    ]);
}

test('active review assignments are cancelled when a proposal is rejected from blind review', function () {
    Queue::fake();
    [$proposal, $central] = crar_makeProposal('under_blind_review');
    $pending = crar_assign($proposal, 'blind_review', 'pending');
    $inProgress = crar_assign($proposal, 'blind_review', 'in_progress');

    app(WorkflowService::class)->transition($proposal, 'fail_blind_review', $central, 'Wrongly approved.');

    expect($pending->fresh()->status)->toBe('cancelled')
        ->and($inProgress->fresh()->status)->toBe('cancelled');

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pending->reviewer_id && $job->event === 'review_assignment_cancelled');
    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $inProgress->reviewer_id && $job->event === 'review_assignment_cancelled');
});

test('a submitted review assignment is left untouched on rejection', function () {
    Queue::fake();
    [$proposal, $central] = crar_makeProposal('blind_review_passed');
    $submitted = crar_assign($proposal, 'blind_review', 'submitted');

    app(WorkflowService::class)->transition($proposal, 'fail_blind_review', $central, 'Wrongly approved.');

    expect($submitted->fresh()->status)->toBe('submitted');
});

test('assignments on other proposals are not affected', function () {
    Queue::fake();
    [$proposal, $central] = crar_makeProposal('under_blind_review');
    [$otherProposal] = crar_makeProposal('under_blind_review');
    $mine = crar_assign($proposal, 'blind_review', 'pending');
    $other = crar_assign($otherProposal, 'blind_review', 'pending');

    app(WorkflowService::class)->transition($proposal, 'fail_blind_review', $central, 'Wrongly approved.');

    expect($mine->fresh()->status)->toBe('cancelled')
        ->and($other->fresh()->status)->toBe('pending');
});

test('a proposal transitioning anywhere other than rejected does not cancel assignments', function () {
    Queue::fake();
    [$proposal, $central] = crar_makeProposal('under_blind_review');
    $pending = crar_assign($proposal, 'blind_review', 'pending');

    app(WorkflowService::class)->transition($proposal, 'pass_blind_review', $central, 'Passed.');

    expect($pending->fresh()->status)->toBe('pending');
});

test('open-defence assignments are cancelled when a proposal fails defence', function () {
    Queue::fake();
    [$proposal, $central] = crar_makeProposal('under_open_defence');
    $assignment = crar_assign($proposal, 'open_defence', 'accepted');

    app(WorkflowService::class)->transition($proposal, 'fail_defence', $central, 'Wrongly accepted.');

    expect($assignment->fresh()->status)->toBe('cancelled');
});
