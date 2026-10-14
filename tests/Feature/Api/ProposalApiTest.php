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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function api_makeBase(): array
{
    $college1 = College::create(['name' => 'API C1 '.rand(), 'code' => 'A1'.rand(10000, 99999)]);
    $college2 = College::create(['name' => 'API C2 '.rand(), 'code' => 'A2'.rand(10000, 99999)]);
    $dept1 = Department::create(['college_id' => $college1->id, 'name' => 'D1', 'code' => 'D1'.rand(10000, 99999)]);
    $dept2 = Department::create(['college_id' => $college2->id, 'name' => 'D2', 'code' => 'D2'.rand(10000, 99999)]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $collegeAdmin = User::factory()->create(['college_id' => $college1->id]);
    $collegeAdmin->assignRole('college_officer');
    $pi1 = User::factory()->create(['college_id' => $college1->id, 'department_id' => $dept1->id]);
    $pi1->assignRole('pi');
    $pi2 = User::factory()->create(['college_id' => $college2->id, 'department_id' => $dept2->id]);
    $pi2->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call',
        'slug' => 'api-'.rand(10000, 99999), 'start_date' => now()->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(), 'status' => 'active',
        'is_open' => true, 'created_by' => $central->id,
    ]);

    $p1 = Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999), 'proposal_call_id' => $call->id,
        'category' => 'research', 'title' => 'C1 Proposal', 'status' => 'submitted',
        'pi_user_id' => $pi1->id, 'college_id' => $college1->id, 'department_id' => $dept1->id,
        'academic_year' => '2026', 'created_by' => $pi1->id,
    ]);
    $p2 = Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999), 'proposal_call_id' => $call->id,
        'category' => 'research', 'title' => 'C2 Proposal', 'status' => 'validated',
        'pi_user_id' => $pi2->id, 'college_id' => $college2->id, 'department_id' => $dept2->id,
        'academic_year' => '2026', 'created_by' => $pi2->id,
    ]);

    return [$college1, $college2, $central, $collegeAdmin, $pi1, $pi2, $p1, $p2];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('central office sees all proposals', function () {
    [,, $central,,,, $p1, $p2] = api_makeBase();

    $response = $this->actingAs($central)->getJson('/api/v1/proposals');

    $response->assertOk();
    $ids = collect($response->json('data.data'))->pluck('id')->toArray();
    expect(in_array($p1->id, $ids))->toBeTrue()
        ->and(in_array($p2->id, $ids))->toBeTrue();
});

test('college admin only sees own college proposals', function () {
    [$college1,, , $collegeAdmin,,,  $p1, $p2] = api_makeBase();

    $response = $this->actingAs($collegeAdmin)->getJson('/api/v1/proposals');

    $response->assertOk();
    $ids = collect($response->json('data.data'))->pluck('id')->toArray();
    expect(in_array($p1->id, $ids))->toBeTrue()
        ->and(in_array($p2->id, $ids))->toBeFalse();
});

test('PI only sees own proposals', function () {
    [,,,, $pi1,, $p1, $p2] = api_makeBase();

    $response = $this->actingAs($pi1)->getJson('/api/v1/proposals');

    $response->assertOk();
    $ids = collect($response->json('data.data'))->pluck('id')->toArray();
    expect(in_array($p1->id, $ids))->toBeTrue()
        ->and(in_array($p2->id, $ids))->toBeFalse();
});

test('validation queue returns submitted proposals only', function () {
    [,, $central] = api_makeBase();

    $response = $this->actingAs($central)->getJson('/api/v1/proposals/validation-queue');

    $response->assertOk();
    $statuses = collect($response->json('data'))->pluck('status')->unique()->toArray();
    expect($statuses)->toBe(['submitted']);
});

test('approve endpoint transitions proposal to validated', function () {
    [,, $central,,,, $p1] = api_makeBase();

    $response = $this->actingAs($central)
        ->postJson("/api/v1/proposals/{$p1->id}/validation/approve");

    $response->assertOk();
    expect(Proposal::find($p1->id)->status)->toBe('validated');
});

test('return endpoint transitions proposal back with reason', function () {
    [,, $central,,,, $p1] = api_makeBase();

    $response = $this->actingAs($central)
        ->postJson("/api/v1/proposals/{$p1->id}/validation/return", [
            'reason' => 'Missing abstract and keywords section.',
        ]);

    $response->assertOk();
    expect(Proposal::find($p1->id)->status)->toBe('draft');
});
