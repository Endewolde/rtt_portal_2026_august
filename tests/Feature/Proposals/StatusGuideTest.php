<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->pi = User::factory()->create();
    $this->pi->assignRole('staff');
    $college = College::create(['name' => 'C'.rand(), 'code' => 'SG'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'SGD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'sg-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addDays(2)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->make = fn (string $status, array $extra = []) => Proposal::create(array_merge([
        'tracker_number' => 'SG-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status, 'pi_user_id' => $this->pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $this->pi->id,
        'status_entered_at' => now()->subDays(3),
    ], $extra));
});

function sg_log(Proposal $p, string $from, string $action, string $to, User $actor): void
{
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $p->id, 'from_stage' => $from, 'action' => $action,
        'to_stage' => $to, 'actor_id' => $actor->id, 'notes' => null, 'metadata' => null, 'created_at' => now(),
    ]);
}

function sg_guide(object $ctx, Proposal $p): array
{
    return $ctx->actingAs($ctx->pi, 'sanctum')->getJson("/api/v1/proposals/{$p->id}/status-guide")->assertOk()->json('data');
}

test('a draft near the call deadline asks the PI to submit, urgently', function () {
    $guide = sg_guide($this, ($this->make)('draft'));

    expect($guide['steps'][0]['state'])->toBe('current')
        ->and($guide['actions'][0]['label'])->toBe('Complete and submit your proposal')
        ->and($guide['actions'][0]['urgent'])->toBeTrue();
});

test('a returned draft says so', function () {
    $p = ($this->make)('draft');
    sg_log($p, 'submitted', 'return_for_correction', 'draft', $this->central);

    $guide = sg_guide($this, $p);

    expect($guide['headline'])->toBe('Returned to you for corrections')
        ->and($guide['actions'][0]['label'])->toBe('Make the corrections and resubmit');
});

test('blind review shows how many reviews are in, with nothing for the PI to do', function () {
    $p = ($this->make)('under_blind_review');
    $type = EvaluationType::create(['name' => 'blind_review_sg', 'label' => 'B', 'proposal_category' => 'research', 'is_active' => true]);
    foreach (['submitted', 'pending'] as $status) {
        ReviewAssignment::create(['proposal_id' => $p->id, 'reviewer_id' => User::factory()->create()->id, 'evaluation_type_id' => $type->id,
            'assigned_by' => $this->central->id, 'status' => $status, 'assigned_at' => now()]);
    }

    $guide = sg_guide($this, $p);

    expect($guide['steps'][2]['state'])->toBe('current')
        ->and($guide['steps'][1]['state'])->toBe('done')
        ->and($guide['explanation'])->toContain('1 of 2 reviews are in')
        ->and($guide['actions'])->toBe([])
        ->and($guide['typical_days'])->toBe(21);
});

test('a funded project lists the contract and ethical clearance as actions', function () {
    $guide = sg_guide($this, ($this->make)('funded', ['ethical_clearance_required' => true]));
    $labels = collect($guide['actions'])->pluck('label');

    expect($labels)->toContain('Sign and submit your research contract')
        ->toContain('Upload your ethical clearance certificate');
});

test('a rejection marks the step it stopped at and offers the next options', function () {
    $p = ($this->make)('rejected', ['rejection_reason' => 'Plagiarism or high similarity']);
    sg_log($p, 'under_blind_review', 'fail_blind_review', 'rejected', $this->central);

    $guide = sg_guide($this, $p);

    expect($guide['steps'][2]['state'])->toBe('stopped')
        ->and($guide['steps'][3]['state'])->toBe('skipped')
        ->and($guide['explanation'])->toContain('Plagiarism or high similarity')
        ->and($guide['actions'][0]['tab'])->toBe('Complaints');
});

test('people outside the proposal cannot see its guide', function () {
    $stranger = User::factory()->create();
    $stranger->assignRole('staff');

    $this->actingAs($stranger, 'sanctum')->getJson('/api/v1/proposals/'.($this->make)('submitted')->id.'/status-guide')->assertForbidden();
});
