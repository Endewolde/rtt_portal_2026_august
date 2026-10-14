<?php

use App\Models\Award;
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
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('staff');
    $college = College::create(['name' => 'C'.rand(), 'code' => 'CA'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CAD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'ca-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->proposal = Proposal::create([
        'tracker_number' => 'CA-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'accepted', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
});

test('the central office approves a proposal with the awarded amount', function () {
    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/central/approve", ['awarded_amount' => 250000, 'remarks' => 'Fund in two tranches.'])
        ->assertOk();

    expect($this->proposal->fresh()->status)->toBe('funded')
        ->and((float) Award::where('proposal_id', $this->proposal->id)->value('awarded_amount'))->toBe(250000.0);
});

test('a refused approval leaves no award behind', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/central/approve", ['awarded_amount' => 250000])
        ->assertStatus(422);

    expect($this->proposal->fresh()->status)->toBe('accepted')
        ->and(Award::where('proposal_id', $this->proposal->id)->exists())->toBeFalse();
});

test('remarks are limited to 2000 characters', function () {
    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/central/approve", ['awarded_amount' => 1000, 'remarks' => str_repeat('a', 2001)])
        ->assertJsonValidationErrors('remarks');
});
