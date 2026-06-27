<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function makeDraftProposal(string $callStatus, string $endDate): array
{
    $college = College::factory()->create();
    $dept    = Department::factory()->create(['college_id' => $college->id]);
    $pi      = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $admin = User::factory()->create();
    $call  = ProposalCall::create([
        'academic_year' => '2024/25',
        'category'      => 'research',
        'title'         => 'Test Call',
        'slug'          => 'test-call-' . rand(10000, 99999),
        'start_date'    => now()->subMonths(6)->toDateString(),
        'end_date'      => $endDate,
        'status'        => $callStatus,
        'is_open'       => $callStatus === 'active',
        'created_by'    => $admin->id,
    ]);

    $proposal = Proposal::create([
        'id'               => str()->uuid(),
        'tracker_number'   => 'DRAFT-' . rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'pi_user_id'       => $pi->id,
        'college_id'       => $college->id,
        'department_id'    => $dept->id,
        'title'            => 'Test Proposal',
        'abstract'         => 'Test abstract.',
        'status'           => 'draft',
        'category'         => 'research',
        'academic_year'    => '2024/25',
        'created_by'       => $pi->id,
    ]);

    return [$pi, $proposal];
}

test('PI cannot submit a draft when the proposal call is expired', function () {
    [$pi, $proposal] = makeDraftProposal('expired', now()->subDay()->toDateString());

    $res = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/submit");

    $res->assertStatus(422);
    $res->assertJsonPath('message', fn ($msg) => str_contains($msg, 'deadline'));
});

test('PI cannot submit a draft when the call end_date has passed even if status is active', function () {
    [$pi, $proposal] = makeDraftProposal('active', now()->subDay()->toDateString());

    $res = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/submit");

    $res->assertStatus(422);
    $res->assertJsonPath('message', fn ($msg) => str_contains($msg, 'deadline'));
});
