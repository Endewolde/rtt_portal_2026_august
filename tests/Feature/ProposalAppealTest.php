<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalAppeal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function createProposalWithStatus(string $status, string $piRole = 'staff'): array
{
    $college = College::factory()->create();
    $dept    = Department::factory()->create(['college_id' => $college->id]);
    $pi      = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole($piRole);

    $admin = User::factory()->create();
    $call = ProposalCall::create([
        'academic_year' => '2024/25', 'category' => 'research',
        'title' => 'Test Call', 'slug' => 'test-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'id'               => \Str::uuid(),
        'tracker_number'   => 'RTT-'.rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'pi_user_id'       => $pi->id,
        'college_id'       => $college->id,
        'department_id'    => $dept->id,
        'title'            => 'Test Proposal',
        'abstract'         => 'Test abstract content.',
        'status'           => $status,
        'category'         => 'research',
        'academic_year'    => '2024/25',
        'created_by'       => $pi->id,
    ]);

    return [$pi, $proposal];
}

test('PI can submit appeal for rejected proposal', function () {
    [$pi, $proposal] = createProposalWithStatus('rejected');

    $res = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/appeal", [
            'reason' => 'We believe the rejection was based on incomplete information about our methodology.',
        ]);

    $res->assertStatus(201);
    $res->assertJsonPath('data.status', 'pending');
    expect(ProposalAppeal::where('proposal_id', $proposal->id)->exists())->toBeTrue();
});

test('PI cannot appeal a non-rejected proposal', function () {
    [$pi, $proposal] = createProposalWithStatus('submitted');

    $res = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/appeal", [
            'reason' => 'This should not work.',
        ]);

    $res->assertStatus(422);
});

test('Cannot submit duplicate pending appeal', function () {
    [$pi, $proposal] = createProposalWithStatus('rejected');

    ProposalAppeal::create([
        'id'           => \Str::uuid(),
        'proposal_id'  => $proposal->id,
        'submitted_by' => $pi->id,
        'reason'       => 'First appeal reason is here.',
        'status'       => 'pending',
    ]);

    $res = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/appeal", [
            'reason' => 'Second appeal attempt.',
        ]);

    $res->assertStatus(422);
});

test('Admin can approve an appeal and proposal returns to draft', function () {
    [$pi, $proposal] = createProposalWithStatus('rejected');

    $admin = User::factory()->create();
    $admin->assignRole('central_officer');

    $appeal = ProposalAppeal::create([
        'id'           => \Str::uuid(),
        'proposal_id'  => $proposal->id,
        'submitted_by' => $pi->id,
        'reason'       => 'Valid reason for reconsideration provided here.',
        'status'       => 'pending',
    ]);

    $res = $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/appeals/{$appeal->id}/resolve", [
            'decision'         => 'approved',
            'resolution_notes' => 'Upon further review, we found merit in the approach.',
        ]);

    $res->assertStatus(200);
    expect($proposal->fresh()->status)->toBe('draft');
    expect($appeal->fresh()->status)->toBe('approved');
});

test('Admin can deny an appeal', function () {
    [$pi, $proposal] = createProposalWithStatus('rejected');

    $admin = User::factory()->create();
    $admin->assignRole('central_officer');

    $appeal = ProposalAppeal::create([
        'id'           => \Str::uuid(),
        'proposal_id'  => $proposal->id,
        'submitted_by' => $pi->id,
        'reason'       => 'Reason for appeal clearly stated here.',
        'status'       => 'pending',
    ]);

    $res = $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/appeals/{$appeal->id}/resolve", [
            'decision'         => 'denied',
            'resolution_notes' => 'The original decision stands after review.',
        ]);

    $res->assertStatus(200);
    expect($proposal->fresh()->status)->toBe('rejected');
    expect($appeal->fresh()->status)->toBe('denied');
});
