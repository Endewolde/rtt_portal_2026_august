<?php

use App\Models\College;
use App\Models\DefenceSession;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();

    $this->college = College::create(['name' => 'College of Engineering', 'code' => 'CE'.rand(10, 99)]);
    $this->department = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'GD'.rand(10, 99)]);

    $this->collegeOfficer = User::factory()->create(['college_id' => $this->college->id]);
    $this->collegeOfficer->assignRole('college_officer');

    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'gate-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->collegeOfficer->id,
    ]);
});

function gate_makeProposal(object $ctx, string $status, ?College $college = null, string $academicYear = '2026'): Proposal
{
    $college ??= $ctx->college;
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    return Proposal::create([
        'tracker_number' => 'GT-'.rand(100000, 999999),
        'proposal_call_id' => $ctx->call->id, 'category' => 'research',
        'title' => 'Proposal '.rand(), 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $ctx->department->id, 'academic_year' => $academicYear, 'created_by' => $pi->id,
    ]);
}

function gate_schedulePayload(): array
{
    return [
        'scheduled_date' => now()->addDays(7)->toDateString(),
        'scheduled_time' => '10:00',
        'venue' => 'Main Hall',
    ];
}

test('a college officer cannot schedule open defence while a college proposal is still under blind review', function () {
    $ready = gate_makeProposal($this, 'blind_review_passed');
    $pending = gate_makeProposal($this, 'under_blind_review');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->postJson("/api/v1/proposals/{$ready->id}/defence/schedule", gate_schedulePayload())
        ->assertStatus(422)
        ->assertJsonPath('meta.reason', 'blind_review_incomplete')
        ->assertJsonPath('meta.college_name', 'College of Engineering')
        ->assertJsonPath('meta.pending_blind_review.0.tracker_number', $pending->tracker_number)
        ->assertJsonPath('message', 'Open defence scheduling is on hold for College of Engineering. 1 proposal is still in the blind review phase. Once every blind review in your college has been completed, you will be able to schedule open defence sessions.');

    expect($ready->fresh()->status)->toBe('blind_review_passed')
        ->and(DefenceSession::where('proposal_id', $ready->id)->exists())->toBeFalse();
});

test('a college proposal still awaiting reviewer assignment also holds open defence', function () {
    $ready = gate_makeProposal($this, 'blind_review_passed');
    gate_makeProposal($this, 'validated');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->postJson("/api/v1/proposals/{$ready->id}/defence/schedule", gate_schedulePayload())
        ->assertStatus(422)
        ->assertJsonPath('meta.reason', 'blind_review_incomplete');
});

test('a college officer can schedule open defence once every college proposal has finished blind review', function () {
    $ready = gate_makeProposal($this, 'blind_review_passed');
    gate_makeProposal($this, 'blind_review_passed');
    gate_makeProposal($this, 'rejected');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->postJson("/api/v1/proposals/{$ready->id}/defence/schedule", gate_schedulePayload())
        ->assertCreated();

    expect($ready->fresh()->status)->toBe('under_open_defence');
});

test('proposals in blind review at another college or academic year do not hold this college back', function () {
    $ready = gate_makeProposal($this, 'blind_review_passed');
    $otherCollege = College::create(['name' => 'Other College', 'code' => 'OC'.rand(10, 99)]);
    gate_makeProposal($this, 'under_blind_review', $otherCollege);
    gate_makeProposal($this, 'under_blind_review', null, '2025');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->postJson("/api/v1/proposals/{$ready->id}/defence/schedule", gate_schedulePayload())
        ->assertCreated();
});

test('central officers are not held back by a college\'s unfinished blind review', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $ready = gate_makeProposal($this, 'blind_review_passed');
    gate_makeProposal($this, 'under_blind_review');

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$ready->id}/defence/schedule", gate_schedulePayload())
        ->assertCreated();
});

test('readiness endpoint lists the remaining blind review proposals for a college officer', function () {
    $ready = gate_makeProposal($this, 'blind_review_passed');
    $pending = gate_makeProposal($this, 'under_blind_review');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->getJson("/api/v1/proposals/{$ready->id}/defence/readiness")
        ->assertOk()
        ->assertJsonPath('data.can_schedule', false)
        ->assertJsonPath('data.college_name', 'College of Engineering')
        ->assertJsonCount(1, 'data.pending_blind_review')
        ->assertJsonPath('data.pending_blind_review.0.id', $pending->id);
});

test('readiness endpoint reports ready once blind review is complete', function () {
    $ready = gate_makeProposal($this, 'blind_review_passed');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->getJson("/api/v1/proposals/{$ready->id}/defence/readiness")
        ->assertOk()
        ->assertJsonPath('data.can_schedule', true)
        ->assertJsonCount(0, 'data.pending_blind_review');
});

test('college readiness puts open defence on hold for a college officer while their college has proposals in blind review', function () {
    DB::table('app_settings')->updateOrInsert(['key' => 'current_academic_year'], ['value' => '2026']);
    $pending = gate_makeProposal($this, 'under_blind_review');
    gate_makeProposal($this, 'under_blind_review', null, '2025');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->getJson('/api/v1/defence/college-readiness')
        ->assertOk()
        ->assertJsonPath('data.can_schedule', false)
        ->assertJsonPath('data.college_name', 'College of Engineering')
        ->assertJsonCount(1, 'data.pending_blind_review')
        ->assertJsonPath('data.pending_blind_review.0.id', $pending->id);
});

test('college readiness is clear once the college has finished blind review', function () {
    DB::table('app_settings')->updateOrInsert(['key' => 'current_academic_year'], ['value' => '2026']);
    gate_makeProposal($this, 'blind_review_passed');
    gate_makeProposal($this, 'rejected');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->getJson('/api/v1/defence/college-readiness')
        ->assertOk()
        ->assertJsonPath('data.can_schedule', true)
        ->assertJsonCount(0, 'data.pending_blind_review');
});

test('college readiness never holds back a central officer', function () {
    $central = User::factory()->create(['college_id' => $this->college->id]);
    $central->assignRole('central_officer');
    gate_makeProposal($this, 'under_blind_review');

    $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/defence/college-readiness')
        ->assertOk()
        ->assertJsonPath('data.can_schedule', true);
});
