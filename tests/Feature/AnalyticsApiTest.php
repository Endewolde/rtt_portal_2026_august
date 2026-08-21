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

function an_makeBase(): array
{
    $college = College::create(['name' => 'AN College '.rand(), 'code' => 'AN'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'AD'.rand(10, 99)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'AN Call', 'slug' => 'an-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return [$college, $dept, $central, $call];
}

function an_proposal(College $college, Department $dept, ProposalCall $call, string $status = 'submitted'): Proposal
{
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return Proposal::create([
        'tracker_number' => 'AN-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'AN Proposal',
        'status' => $status,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);
}

test('unauthenticated user cannot access analytics', function () {
    $this->getJson('/api/v1/admin/analytics')->assertUnauthorized();
});

test('a user without an analytics role cannot access analytics', function () {
    [$college, $dept, $central, $call] = an_makeBase();
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/admin/analytics')
        ->assertForbidden();
});

test('admin gets the full analytics payload structure', function () {
    [$college, $dept, $central, $call] = an_makeBase();
    an_proposal($college, $dept, $call, 'funded');
    an_proposal($college, $dept, $call, 'rejected');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/analytics?academic_year=2026');

    $response->assertOk();
    $response->assertJsonStructure([
        'data' => [
            'filters', 'academicYears', 'colleges', 'summaryStats',
            'researchTypes', 'collegePerf', 'passRateTrends', 'appTrends',
            'genderPassRate', 'yearDistribution', 'collegeTypeDist', 'predictive',
        ],
    ]);

    $stats = $response->json('data.summaryStats');
    expect($stats['total'])->toBe(2)
        ->and($stats['funded'])->toBe(1)
        ->and($stats['rejected'])->toBe(1);
});

test('college officer cannot see another college\'s data by spoofing college_id', function () {
    [$collegeA, $deptA, $central, $callA] = an_makeBase();
    $collegeB = College::create(['name' => 'AN College B '.rand(), 'code' => 'AB'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'ABD'.rand(10, 99)]);

    an_proposal($collegeA, $deptA, $callA, 'funded');
    an_proposal($collegeB, $deptB, $callA, 'funded');
    an_proposal($collegeB, $deptB, $callA, 'funded');

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')
        ->getJson('/api/v1/admin/analytics?academic_year=2026&college_id='.$collegeB->id);

    $response->assertOk();
    expect($response->json('data.filters.college_id'))->toBe($collegeA->id)
        ->and($response->json('data.summaryStats.total'))->toBe(1);

    $collegeNames = collect($response->json('data.collegePerf'))->pluck('college');
    expect($collegeNames)->toContain($collegeA->name)
        ->not->toContain($collegeB->name);
});

test('college officer sidebar-equivalent role list can all reach analytics', function () {
    [$college, $dept] = an_makeBase();

    foreach (['research_officer', 'community_officer', 'technology_officer'] as $role) {
        $user = User::factory()->create(['college_id' => $college->id]);
        $user->assignRole($role);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/admin/analytics')
            ->assertOk();
    }
});
