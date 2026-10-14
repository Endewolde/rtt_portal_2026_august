<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function an_makeBase(): array
{
    $college = College::create(['name' => 'AN College '.rand(), 'code' => 'AN'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'AD'.rand(10000, 99999)]);
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

function an_proposal(College $college, Department $dept, ProposalCall $call, string $status = 'submitted', string $year = '2026', string $category = 'research'): Proposal
{
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return Proposal::create([
        'tracker_number' => 'AN-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => $category,
        'title' => 'AN Proposal',
        'status' => $status,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => $year,
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
            'filters', 'academicYears', 'college_options', 'summary', 'funnel', 'pipeline',
            'categories', 'colleges', 'years', 'monthly', 'researchTypes', 'gender',
            'money', 'review', 'forecast',
        ],
    ]);

    $stats = $response->json('data.summary');
    expect($stats['submitted'])->toBe(2)
        ->and($stats['funded'])->toBe(1)
        ->and($stats['rejected'])->toBe(1);
});

test('college officer cannot see another college\'s data by spoofing college_id', function () {
    [$collegeA, $deptA, $central, $callA] = an_makeBase();
    $collegeB = College::create(['name' => 'AN College B '.rand(), 'code' => 'AB'.rand(10000, 99999)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'ABD'.rand(10000, 99999)]);

    an_proposal($collegeA, $deptA, $callA, 'funded');
    an_proposal($collegeB, $deptB, $callA, 'funded');
    an_proposal($collegeB, $deptB, $callA, 'funded');

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')
        ->getJson('/api/v1/admin/analytics?academic_year=2026&college_id='.$collegeB->id);

    $response->assertOk();
    expect($response->json('data.filters.college_id'))->toBe($collegeA->id)
        ->and($response->json('data.summary.submitted'))->toBe(1);

    $collegeNames = collect($response->json('data.colleges'))->pluck('college');
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

test('funded means funded or beyond, and pass rate only counts decided proposals', function () {
    [$college, $dept, $central, $call] = an_makeBase();
    foreach (['funded', 'midterm_evaluation', 'completed', 'accepted', 'under_blind_review', 'rejected'] as $status) {
        an_proposal($college, $dept, $call, $status);
    }

    $summary = $this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/analytics?academic_year=2026')->json('data.summary');

    // Awaiting the central decision ("accepted") is in progress, not funded.
    expect($summary)->toMatchArray(['submitted' => 6, 'funded' => 3, 'rejected' => 1, 'in_progress' => 2, 'decided' => 4])
        ->and($summary['pass_rate'])->toEqual(75);
});

test('"all" shows every academic year; no year means the current one', function () {
    [$college, $dept, $central, $call] = an_makeBase();
    DB::table('app_settings')->updateOrInsert(['key' => 'current_academic_year'], ['id' => (string) Str::uuid(), 'value' => '2026', 'type' => 'string', 'group' => 'general']);
    an_proposal($college, $dept, $call, 'funded', '2026');
    an_proposal($college, $dept, $call, 'funded', '2025');

    $this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/analytics')
        ->assertJsonPath('data.filters.academic_year', '2026')
        ->assertJsonPath('data.summary.submitted', 1);

    $this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/analytics?academic_year=all')
        ->assertJsonPath('data.filters.academic_year', null)
        ->assertJsonPath('data.summary.submitted', 2);
});

test('a category director only sees their own category, whatever they ask for', function () {
    [$college, $dept, $central, $call] = an_makeBase();
    an_proposal($college, $dept, $call, 'funded', '2026', 'research');
    an_proposal($college, $dept, $call, 'funded', '2026', 'community_engagement');
    $director = User::factory()->create();
    $director->assignRole('research_officer');

    $this->actingAs($director, 'sanctum')->getJson('/api/v1/admin/analytics?academic_year=all&category=community_engagement')
        ->assertJsonPath('data.filters.category', 'research')
        ->assertJsonPath('data.filters.category_locked', true)
        ->assertJsonPath('data.summary.submitted', 1);
});

test('the funnel counts a rejected proposal up to the stage it stopped at', function () {
    [$college, $dept, $central, $call] = an_makeBase();
    an_proposal($college, $dept, $call, 'funded');
    $rejected = an_proposal($college, $dept, $call, 'rejected');
    DB::table('workflow_logs')->insert(['id' => (string) Str::uuid(), 'proposal_id' => $rejected->id, 'from_stage' => 'under_blind_review',
        'action' => 'fail_blind_review', 'to_stage' => 'rejected', 'actor_id' => $central->id, 'created_at' => now()]);

    $funnel = collect($this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/analytics?academic_year=2026')->json('data.funnel'))->pluck('count', 'key');

    expect($funnel->all())->toBe(['submitted' => 2, 'validated' => 2, 'blind_passed' => 1, 'defence_passed' => 1, 'funded' => 1]);
});

test('no forecast without three completed years; a steady trend gives one', function () {
    [$college, $dept, $central, $call] = an_makeBase();
    DB::table('app_settings')->updateOrInsert(['key' => 'current_academic_year'], ['id' => (string) Str::uuid(), 'value' => '2026-2027', 'type' => 'string', 'group' => 'general']);
    an_proposal($college, $dept, $call, 'funded', '2024-2025');
    an_proposal($college, $dept, $call, 'funded', '2026-2027');

    $this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/analytics')->assertJsonPath('data.forecast.available', false);

    foreach (['2023-2024' => 2, '2024-2025' => 2, '2025' => 5] as $year => $count) {
        for ($i = 0; $i < $count; $i++) {
            an_proposal($college, $dept, $call, 'funded', $year);
        }
    }

    // 2023: 2, 2024: 3, 2025: 5 — "2025" and "2025-2026" are one year; the current year is excluded.
    $forecast = $this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/analytics')->json('data.forecast');
    expect($forecast['available'])->toBeTrue()
        ->and(collect($forecast['history'])->pluck('actual', 'year')->all())->toBe(['2023-2024' => 2, '2024-2025' => 3, '2025-2026' => 5])
        ->and($forecast['predictions'][0]['year'])->toBe('2026-2027');
});
