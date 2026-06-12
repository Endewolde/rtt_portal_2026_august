<?php

use App\Models\College;
use App\Models\Department;
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

test('unauthenticated request to protected endpoint returns 401', function () {
    $this->getJson('/api/v1/auth/me')->assertStatus(401);
    $this->getJson('/api/v1/dashboard')->assertStatus(401);
    $this->getJson('/api/v1/proposals')->assertStatus(401);
});

test('reviewer cannot create proposal calls', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->postJson('/api/v1/proposal-calls', [
            'academic_year' => '2026',
            'category'      => 'research',
            'title'         => 'Hacked Call',
            'start_date'    => now()->toDateString(),
            'end_date'      => now()->addMonth()->toDateString(),
        ])
        ->assertStatus(403);
});

test('PI cannot create proposal calls', function () {
    $college = College::create(['name' => 'C1', 'code' => 'C1']);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D1', 'code' => 'D1']);
    $pi      = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')
        ->postJson('/api/v1/proposal-calls', [
            'academic_year' => '2026',
            'category'      => 'research',
            'title'         => 'Unauthorized Call',
            'start_date'    => now()->toDateString(),
            'end_date'      => now()->addMonth()->toDateString(),
        ])
        ->assertStatus(403);
});

test('Finance user cannot validate proposals', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $college = College::create(['name' => 'C2', 'code' => 'C2']);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D2', 'code' => 'D2']);
    $pi      = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $finance = User::factory()->create();
    $finance->assignRole('finance_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call2',
        'slug'          => 'call-fin-'.rand(), 'start_date' => now()->toDateString(),
        'end_date'      => now()->addMonths(3)->toDateString(), 'status' => 'active',
        'is_open'       => true, 'created_by' => $central->id,
    ]);

    $draft = $this->actingAs($pi, 'sanctum')
        ->postJson('/api/v1/proposals/draft', ['proposal_call_id' => $call->id])
        ->json('data.id');

    $this->actingAs($finance, 'sanctum')
        ->postJson("/api/v1/proposals/{$draft}/validation/approve")
        ->assertStatus(403);
});

test('finance user cannot activate proposal calls', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $finance = User::factory()->create();
    $finance->assignRole('finance_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Draft Call',
        'slug'          => 'draft-call-'.rand(), 'start_date' => now()->toDateString(),
        'end_date'      => now()->addMonths(3)->toDateString(), 'status' => 'draft',
        'is_open'       => false, 'created_by' => $central->id,
    ]);

    $this->actingAs($finance, 'sanctum')
        ->postJson("/api/v1/proposal-calls/{$call->id}/activate")
        ->assertStatus(403);
});

test('Guest cannot access any authenticated endpoint', function () {
    $this->getJson('/api/v1/proposals')->assertStatus(401);
    $this->getJson('/api/v1/dashboard')->assertStatus(401);
    $this->getJson('/api/v1/complaints')->assertStatus(401);
});
