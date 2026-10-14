<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function rfbr_makeProposal(string $status): Proposal
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'RB'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RBD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'rb-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'RB-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

test('central_officer can reject a proposal currently under_blind_review', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $proposal = rfbr_makeProposal('under_blind_review');

    $response = $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/blind-review/reject", [
            'reason' => 'Discovered this is a duplicate of an already-funded proposal.',
        ]);

    $response->assertOk();
    expect(Proposal::find($proposal->id)->status)->toBe('rejected');
    $this->assertDatabaseHas('workflow_logs', [
        'proposal_id' => $proposal->id, 'from_stage' => 'under_blind_review',
        'action' => 'fail_blind_review', 'to_stage' => 'rejected',
    ]);
    $this->assertDatabaseHas('audit_logs', [
        'auditable_id' => $proposal->id, 'event' => 'review.rejected_from_blind_review',
    ]);
});

test('central_officer can reject a proposal that already passed blind review', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $proposal = rfbr_makeProposal('blind_review_passed');

    $response = $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/blind-review/reject", [
            'reason' => 'PI was found to be ineligible after review completed.',
        ]);

    $response->assertOk();
    expect(Proposal::find($proposal->id)->status)->toBe('rejected');
    $this->assertDatabaseHas('workflow_logs', [
        'proposal_id' => $proposal->id, 'from_stage' => 'blind_review_passed',
        'action' => 'fail_blind_review', 'to_stage' => 'rejected',
    ]);
});

test('a college_officer cannot reject a proposal from blind review', function () {
    $officer = User::factory()->create();
    $officer->assignRole('college_officer');
    $proposal = rfbr_makeProposal('under_blind_review');

    $response = $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/blind-review/reject", [
            'reason' => 'Trying to reject without the right role.',
        ]);

    $response->assertStatus(403);
    expect(Proposal::find($proposal->id)->status)->toBe('under_blind_review');
});

test('a PI cannot reject their own proposal from blind review', function () {
    $proposal = rfbr_makeProposal('under_blind_review');
    $pi = User::find($proposal->pi_user_id);

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/blind-review/reject", [
            'reason' => 'Trying to reject own proposal.',
        ])
        ->assertStatus(403);
});

test('rejecting from blind review requires a reason of at least 10 characters', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $proposal = rfbr_makeProposal('under_blind_review');

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/blind-review/reject", ['reason' => 'too short'])
        ->assertStatus(422);

    expect(Proposal::find($proposal->id)->status)->toBe('under_blind_review');
});

test('a proposal not currently in blind review cannot be rejected via this endpoint', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $proposal = rfbr_makeProposal('draft');

    $response = $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/blind-review/reject", [
            'reason' => 'This should not be allowed from draft status.',
        ]);

    $response->assertStatus(422);
    expect(Proposal::find($proposal->id)->status)->toBe('draft');
});
