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

function pp_makeBase(): array
{
    $college = College::create(['name' => 'PP College '.rand(), 'code' => 'PP'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'PPD'.rand(10, 99)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'PP Call', 'slug' => 'pp-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return [$college, $dept, $central, $call];
}

function pp_proposal(College $college, Department $dept, ProposalCall $call, string $category, string $status): Proposal
{
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return Proposal::create([
        'tracker_number' => 'PP-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => $category,
        'title' => 'PP Proposal',
        'status' => $status,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);
}

test('unauthenticated user cannot access the pipeline', function () {
    $this->getJson('/api/v1/proposal-pipeline')->assertUnauthorized();
});

test('a user without an allowed role cannot access the pipeline', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/proposal-pipeline')
        ->assertForbidden();
});

test('returns stage counts and a filtered proposal list for the academic year', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    pp_proposal($college, $dept, $call, 'research', 'under_blind_review');
    pp_proposal($college, $dept, $call, 'research', 'under_blind_review');
    pp_proposal($college, $dept, $call, 'research', 'funded');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/proposal-pipeline?academic_year=2026');

    $response->assertOk();
    expect($response->json('data.total'))->toBe(3)
        ->and($response->json('data.stage_counts.under_blind_review'))->toBe(2)
        ->and($response->json('data.stage_counts.funded'))->toBe(1)
        ->and(collect($response->json('data.proposals.data'))->count())->toBe(3);
});

test('the status filter narrows the proposal list but stage_counts keeps the full breakdown', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    pp_proposal($college, $dept, $call, 'research', 'under_blind_review');
    pp_proposal($college, $dept, $call, 'research', 'funded');

    $response = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/proposal-pipeline?academic_year=2026&status=funded');

    $response->assertOk();
    $rows = collect($response->json('data.proposals.data'));

    expect($rows->count())->toBe(1)
        ->and($rows->first()['status'])->toBe('funded')
        ->and($response->json('data.stage_counts.under_blind_review'))->toBe(1)
        ->and($response->json('data.stage_counts.funded'))->toBe(1);
});

test('college officer is scoped to their own college even if a different college_id is requested', function () {
    [$collegeA, $deptA, $central, $callA] = pp_makeBase();
    $collegeB = College::create(['name' => 'PP College B '.rand(), 'code' => 'PB'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'PBD'.rand(10, 99)]);

    pp_proposal($collegeA, $deptA, $callA, 'research', 'submitted');
    pp_proposal($collegeB, $deptB, $callA, 'research', 'submitted');
    pp_proposal($collegeB, $deptB, $callA, 'research', 'submitted');

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')
        ->getJson('/api/v1/proposal-pipeline?academic_year=2026&college_id='.$collegeB->id);

    $response->assertOk();
    expect($response->json('data.total'))->toBe(1);
    $collegeIds = collect($response->json('data.proposals.data'))->pluck('college_id')->unique();
    expect($collegeIds->all())->toBe([$collegeA->id]);
});

test('a category officer only ever sees their own category', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    pp_proposal($college, $dept, $call, 'research', 'submitted');
    pp_proposal($college, $dept, $call, 'technology_transfer', 'submitted');

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')
        ->getJson('/api/v1/proposal-pipeline?academic_year=2026&category=technology_transfer');

    $response->assertOk();
    expect($response->json('data.total'))->toBe(1);
    $categories = collect($response->json('data.proposals.data'))->pluck('category')->unique();
    expect($categories->all())->toBe(['research']);
});

test('export downloads an xlsx file honoring the same filters and scoping as the list', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    pp_proposal($college, $dept, $call, 'research', 'under_blind_review');
    pp_proposal($college, $dept, $call, 'research', 'funded');

    $response = $this->actingAs($central, 'sanctum')
        ->get('/api/v1/proposal-pipeline/export?academic_year=2026&status=funded');

    $response->assertOk();
    $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('a user without an allowed role cannot export the pipeline', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')
        ->get('/api/v1/proposal-pipeline/export')
        ->assertForbidden();
});

test('draft proposals are excluded from stage counts, the total, and the list', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    pp_proposal($college, $dept, $call, 'research', 'draft');
    pp_proposal($college, $dept, $call, 'research', 'draft');
    pp_proposal($college, $dept, $call, 'research', 'submitted');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/proposal-pipeline?academic_year=2026');

    $response->assertOk();
    expect($response->json('data.total'))->toBe(1)
        ->and($response->json('data.stage_counts.draft'))->toBeNull()
        ->and(collect($response->json('data.proposals.data'))->pluck('status')->all())->toBe(['submitted']);
});

test('the academic_years filter option list never includes a year that only has drafts', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    $draftOnlyCall = ProposalCall::create([
        'academic_year' => '2099', 'category' => 'research',
        'title' => 'Draft-only Call', 'slug' => 'pp-draft-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    Proposal::create([
        'tracker_number' => 'PP-'.rand(100000, 999999), 'proposal_call_id' => $draftOnlyCall->id,
        'category' => 'research', 'title' => 'Draft', 'status' => 'draft',
        'pi_user_id' => $pi->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2099', 'created_by' => $pi->id,
    ]);
    pp_proposal($college, $dept, $call, 'research', 'submitted');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/proposal-pipeline?academic_year=2026');

    $response->assertOk();
    expect($response->json('data.academic_years'))->not->toContain('2099');
});

test('sorting by tracker number works in both directions', function () {
    [$college, $dept, $central, $call] = pp_makeBase();
    $a = pp_proposal($college, $dept, $call, 'research', 'submitted');
    $a->update(['tracker_number' => 'AAA-000001']);
    $b = pp_proposal($college, $dept, $call, 'research', 'submitted');
    $b->update(['tracker_number' => 'ZZZ-999999']);

    $asc = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/proposal-pipeline?academic_year=2026&sort=tracker&direction=asc');
    expect(collect($asc->json('data.proposals.data'))->pluck('tracker_number')->all())
        ->toBe(['AAA-000001', 'ZZZ-999999']);

    $desc = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/proposal-pipeline?academic_year=2026&sort=tracker&direction=desc');
    expect(collect($desc->json('data.proposals.data'))->pluck('tracker_number')->all())
        ->toBe(['ZZZ-999999', 'AAA-000001']);
});

test('sorting by pi name joins the users table correctly', function () {
    [$college, $dept, $central, $call] = pp_makeBase();

    $piA = User::factory()->create(['name' => 'Aaron Adams', 'college_id' => $college->id, 'department_id' => $dept->id]);
    $piA->assignRole('pi');
    $piZ = User::factory()->create(['name' => 'Zoe Zimmerman', 'college_id' => $college->id, 'department_id' => $dept->id]);
    $piZ->assignRole('pi');

    Proposal::create([
        'tracker_number' => 'PP-'.rand(100000, 999999), 'proposal_call_id' => $call->id,
        'category' => 'research', 'title' => 'P1', 'status' => 'submitted',
        'pi_user_id' => $piZ->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026', 'created_by' => $piZ->id,
    ]);
    Proposal::create([
        'tracker_number' => 'PP-'.rand(100000, 999999), 'proposal_call_id' => $call->id,
        'category' => 'research', 'title' => 'P2', 'status' => 'submitted',
        'pi_user_id' => $piA->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026', 'created_by' => $piA->id,
    ]);

    $response = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/proposal-pipeline?academic_year=2026&sort=pi&direction=asc');

    $response->assertOk();
    $names = collect($response->json('data.proposals.data'))->pluck('pi.name')->all();
    expect($names)->toBe(['Aaron Adams', 'Zoe Zimmerman']);
});
