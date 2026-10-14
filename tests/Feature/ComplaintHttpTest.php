<?php

use App\Models\College;
use App\Models\Complaint;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    Queue::fake();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function http_makeBase(): array
{
    $college = College::create(['name' => 'HTTP College '.rand(), 'code' => 'HT'.rand(10000, 99999)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'HD'.rand(10000, 99999)]);

    $central        = User::factory()->create(); $central->assignRole('central_officer');
    $collegeOfficer = User::factory()->create(['college_id' => $college->id]); $collegeOfficer->assignRole('college_officer');
    $pi             = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]); $pi->assignRole('pi');

    foreach ([$central, $collegeOfficer, $pi] as $u) {
        NotificationPreference::firstOrCreate(['user_id' => $u->id], [
            'email_enabled' => true, 'telegram_enabled' => false, 'inapp_enabled' => true,
        ]);
    }

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'http-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category'         => 'research',
        'title'            => 'HTTP Test Proposal',
        'status'           => 'under_blind_review',
        'pi_user_id'       => $pi->id,
        'college_id'       => $college->id,
        'department_id'    => $dept->id,
        'academic_year'    => '2026',
        'created_by'       => $pi->id,
    ]);

    return [$proposal, $pi, $central, $collegeOfficer, $college];
}

function http_description(): string
{
    return 'This is a detailed test complaint description longer than fifty characters for testing.';
}

// ─── GET /proposals/{id}/complaints ──────────────────────────────────────────

test('PI can fetch complaints for their own proposal', function () {
    [$proposal, $pi] = http_makeBase();

    Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'blind_review',
        'level'          => 'college',
        'description'    => http_description(),
        'status'         => 'open',
    ]);

    $response = $this->actingAs($pi)->getJson("/api/v1/proposals/{$proposal->id}/complaints");

    $response->assertOk()->assertJsonCount(1, 'data');
});

test('non-member gets empty list for proposal complaints', function () {
    [$proposal] = http_makeBase();
    $outsider = User::factory()->create(); $outsider->assignRole('pi');

    $response = $this->actingAs($outsider)->getJson("/api/v1/proposals/{$proposal->id}/complaints");

    $response->assertOk()->assertJsonCount(0, 'data');
});

test('college officer sees only college-level complaints on proposal', function () {
    [$proposal, $pi,, $collegeOfficer] = http_makeBase();

    Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);
    Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'post_funding', 'level' => 'officer', 'complaint_type' => 'budget',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($collegeOfficer)->getJson("/api/v1/proposals/{$proposal->id}/complaints");

    $response->assertOk()->assertJsonCount(1, 'data');
    expect($response->json('data.0.level'))->toBe('college');
});

test('admin sees all complaint levels for a proposal', function () {
    [$proposal, $pi, $central] = http_makeBase();

    Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);
    Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'post_funding', 'level' => 'officer', 'complaint_type' => 'rejection',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($central)->getJson("/api/v1/proposals/{$proposal->id}/complaints");

    $response->assertOk()->assertJsonCount(2, 'data');
});

// ─── POST /proposals/{id}/complaints (college level) ─────────────────────────

test('PI can file a blind_review complaint when proposal is under blind review', function () {
    [$proposal, $pi] = http_makeBase();

    $response = $this->actingAs($pi)->postJson("/api/v1/proposals/{$proposal->id}/complaints", [
        'stage'       => 'blind_review',
        'description' => http_description(),
    ]);

    $response->assertCreated();
    expect($response->json('data.level'))->toBe('college')
        ->and($response->json('data.stage'))->toBe('blind_review');
});

test('college complaint rejected when description is under 50 characters', function () {
    [$proposal, $pi] = http_makeBase();

    $response = $this->actingAs($pi)->postJson("/api/v1/proposals/{$proposal->id}/complaints", [
        'stage'       => 'blind_review',
        'description' => 'Too short',
    ]);

    $response->assertUnprocessable();
});

test('college complaint requires valid stage value', function () {
    [$proposal, $pi] = http_makeBase();

    $response = $this->actingAs($pi)->postJson("/api/v1/proposals/{$proposal->id}/complaints", [
        'stage'       => 'post_funding',
        'description' => http_description(),
    ]);

    $response->assertUnprocessable();
});

test('duplicate open college complaint for same proposal and stage is rejected with 409', function () {
    [$proposal, $pi] = http_makeBase();

    $this->actingAs($pi)->postJson("/api/v1/proposals/{$proposal->id}/complaints", [
        'stage' => 'blind_review', 'description' => http_description(),
    ])->assertCreated();

    $response = $this->actingAs($pi)->postJson("/api/v1/proposals/{$proposal->id}/complaints", [
        'stage' => 'blind_review', 'description' => http_description(),
    ]);

    $response->assertStatus(409);
});

// ─── POST /proposals/{id}/complaints/officer (officer level) ─────────────────

test('PI can file a budget complaint when proposal is funded', function () {
    [$proposal, $pi, $central] = http_makeBase();
    $proposal->update(['status' => 'funded']);

    $researchOfficer = User::factory()->create(); $researchOfficer->assignRole('research_officer');
    NotificationPreference::firstOrCreate(['user_id' => $researchOfficer->id], [
        'email_enabled' => true, 'telegram_enabled' => false, 'inapp_enabled' => true,
    ]);

    $response = $this->actingAs($pi)->postJson("/api/v1/proposals/{$proposal->id}/complaints/officer", [
        'complaint_type' => 'budget',
        'description'    => http_description(),
    ]);

    $response->assertCreated();
    expect($response->json('data.level'))->toBe('officer')
        ->and($response->json('data.complaint_type'))->toBe('budget');
});

test('officer complaint rejected when proposal is not funded', function () {
    [$proposal, $pi] = http_makeBase();
    // proposal is under_blind_review, not funded

    $response = $this->actingAs($pi)->postJson("/api/v1/proposals/{$proposal->id}/complaints/officer", [
        'complaint_type' => 'budget',
        'description'    => http_description(),
    ]);

    $response->assertStatus(422);
});

// ─── POST /complaints/{id}/escalate ──────────────────────────────────────────

test('PI can escalate a resolved college complaint to officer level', function () {
    [$proposal, $pi, $central] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'blind_review',
        'level'          => 'college',
        'description'    => http_description(),
        'status'         => 'resolved',
    ]);

    $response = $this->actingAs($pi)->postJson("/api/v1/complaints/{$complaint->id}/escalate", [
        'description' => 'I am not satisfied with the response and would like to escalate this complaint.',
    ]);

    $response->assertCreated();
    expect($response->json('data.level'))->toBe('officer')
        ->and($response->json('data.complaint_type'))->toBe('escalation');
    expect(Complaint::find($complaint->id)->status)->toBe('escalated');
});

test('user cannot escalate another user\'s complaint', function () {
    [$proposal, $pi] = http_makeBase();
    $other = User::factory()->create(); $other->assignRole('pi');

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'blind_review',
        'level'          => 'college',
        'description'    => http_description(),
        'status'         => 'resolved',
    ]);

    $response = $this->actingAs($other)->postJson("/api/v1/complaints/{$complaint->id}/escalate", [
        'description' => 'Trying to escalate another users complaint which must not be allowed here.',
    ]);

    $response->assertStatus(422);
});

// ─── POST /complaints/{id}/respond ───────────────────────────────────────────

test('college officer can resolve a college-level complaint', function () {
    [$proposal, $pi,, $collegeOfficer] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'blind_review',
        'level'          => 'college',
        'description'    => http_description(),
        'status'         => 'open',
        'assigned_to'    => $collegeOfficer->id,
    ]);

    $response = $this->actingAs($collegeOfficer)->postJson("/api/v1/complaints/{$complaint->id}/respond", [
        'response'   => 'We have reviewed your complaint and resolved the issue accordingly.',
        'resolution' => 'resolved',
    ]);

    $response->assertOk();
    expect($response->json('data.status'))->toBe('resolved');
});

test('college officer cannot respond to officer-level complaint', function () {
    [$proposal, $pi,, $collegeOfficer] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'post_funding',
        'level'          => 'officer',
        'complaint_type' => 'budget',
        'description'    => http_description(),
        'status'         => 'open',
    ]);

    $response = $this->actingAs($collegeOfficer)->postJson("/api/v1/complaints/{$complaint->id}/respond", [
        'response'   => 'Attempting to respond to an officer-level complaint as a college officer.',
        'resolution' => 'resolved',
    ]);

    $response->assertStatus(422);
});

// ─── GET /complaints index scoping ───────────────────────────────────────────

test('college officer index returns only their college complaints', function () {
    [$proposal, $pi, $central, $collegeOfficer, $college] = http_makeBase();

    // Another college with its own proposal and complaint
    $otherCollege  = College::create(['name' => 'Other '.rand(), 'code' => 'OT'.rand(10000, 99999)]);
    $otherDept     = Department::create(['college_id' => $otherCollege->id, 'name' => 'OD', 'code' => 'OD'.rand(10000, 99999)]);
    $otherPi       = User::factory()->create(['college_id' => $otherCollege->id, 'department_id' => $otherDept->id]); $otherPi->assignRole('pi');
    $call          = ProposalCall::first();
    $otherProposal = Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999), 'proposal_call_id' => $call->id,
        'category' => 'research', 'title' => 'Other Proposal', 'status' => 'under_blind_review',
        'pi_user_id' => $otherPi->id, 'college_id' => $otherCollege->id,
        'department_id' => $otherDept->id, 'academic_year' => '2026', 'created_by' => $otherPi->id,
    ]);

    Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);
    Complaint::create([
        'proposal_id' => $otherProposal->id, 'complainant_id' => $otherPi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($collegeOfficer)->getJson('/api/v1/complaints?level=college');
    $proposalIds = collect($response->json('data.data'))->pluck('proposal_id');

    expect($proposalIds->every(fn ($id) => $id === $proposal->id))->toBeTrue();
});

// ─── GET /complaints/{id} (show) ─────────────────────────────────────────────

test('PI can view their own complaint', function () {
    [$proposal, $pi] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($pi)->getJson("/api/v1/complaints/{$complaint->id}");

    $response->assertOk();
    expect($response->json('data.id'))->toBe($complaint->id);
});

test('outsider cannot view a complaint they did not file', function () {
    [$proposal, $pi] = http_makeBase();
    $other = User::factory()->create(); $other->assignRole('pi');

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($other)->getJson("/api/v1/complaints/{$complaint->id}");

    $response->assertForbidden();
});

test('college officer can view college-level complaint for their college', function () {
    [$proposal, $pi,, $collegeOfficer] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($collegeOfficer)->getJson("/api/v1/complaints/{$complaint->id}");

    $response->assertOk()->assertJsonPath('data.level', 'college');
});

// ─── PUT /complaints/{id} (update) ───────────────────────────────────────────

test('PI can edit description of their open complaint', function () {
    [$proposal, $pi] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $newDescription = 'Updated description that is definitely longer than fifty characters for the test.';

    $response = $this->actingAs($pi)->putJson("/api/v1/complaints/{$complaint->id}", [
        'description' => $newDescription,
    ]);

    $response->assertOk();
    expect($response->json('data.description'))->toBe($newDescription);
});

test('PI cannot edit a resolved complaint', function () {
    [$proposal, $pi] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'resolved',
    ]);

    $response = $this->actingAs($pi)->putJson("/api/v1/complaints/{$complaint->id}", [
        'description' => 'Trying to edit a resolved complaint which should not be allowed at all.',
    ]);

    $response->assertStatus(422);
});

test('another user cannot edit someone else\'s complaint', function () {
    [$proposal, $pi] = http_makeBase();
    $other = User::factory()->create(); $other->assignRole('pi');

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($other)->putJson("/api/v1/complaints/{$complaint->id}", [
        'description' => 'Attempting to edit another users complaint which is strictly forbidden here.',
    ]);

    $response->assertForbidden();
});

test('edit complaint rejects description shorter than 50 characters', function () {
    [$proposal, $pi] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($pi)->putJson("/api/v1/complaints/{$complaint->id}", [
        'description' => 'Too short',
    ]);

    $response->assertUnprocessable();
});

// ─── DELETE /complaints/{id} (withdraw) ──────────────────────────────────────

test('PI can withdraw their own open complaint', function () {
    [$proposal, $pi] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($pi)->deleteJson("/api/v1/complaints/{$complaint->id}");

    $response->assertOk();
    expect(Complaint::find($complaint->id))->toBeNull();
});

test('PI cannot withdraw a complaint that is already under review', function () {
    [$proposal, $pi] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'under_review',
    ]);

    $response = $this->actingAs($pi)->deleteJson("/api/v1/complaints/{$complaint->id}");

    $response->assertStatus(422);
    expect(Complaint::find($complaint->id))->not->toBeNull();
});

test('another user cannot withdraw someone else\'s complaint', function () {
    [$proposal, $pi] = http_makeBase();
    $other = User::factory()->create(); $other->assignRole('pi');

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($other)->deleteJson("/api/v1/complaints/{$complaint->id}");

    $response->assertForbidden();
    expect(Complaint::find($complaint->id))->not->toBeNull();
});

test('admin can withdraw any open complaint', function () {
    [$proposal, $pi, $central] = http_makeBase();

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id, 'complainant_id' => $pi->id,
        'stage' => 'blind_review', 'level' => 'college',
        'description' => http_description(), 'status' => 'open',
    ]);

    $response = $this->actingAs($central)->deleteJson("/api/v1/complaints/{$complaint->id}");

    $response->assertOk();
    expect(Complaint::find($complaint->id))->toBeNull();
});
