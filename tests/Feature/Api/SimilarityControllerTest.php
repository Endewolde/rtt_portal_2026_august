<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\SimilarityScore;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function sc_proposal(User $creator, string $category = 'research'): Proposal
{
    $college = College::create(['name' => 'SC College '.rand(), 'code' => 'SC'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'SCD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'Call', 'slug' => 'sc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $creator->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'SC-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => 'P', 'status' => 'submitted',
        'pi_user_id' => $creator->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $creator->id,
    ]);
}

function sc_score(Proposal $a, Proposal $b, float $score, bool $flagged): SimilarityScore
{
    return SimilarityScore::create([
        'id' => (string) Str::orderedUuid(),
        'proposal_id' => $a->id,
        'similar_proposal_id' => $b->id,
        'score' => $score,
        'flagged' => $flagged,
        'checked_at' => now(),
    ]);
}

test('an authenticated user can list similarity flags', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $a = sc_proposal($pi);
    $b = sc_proposal($pi);
    sc_score($a, $b, 0.85, true);

    $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/similarity-scores')
        ->assertOk()
        ->assertJsonPath('data.data.0.score', 0.85);
});

test('flagged_only filters out unflagged pairs', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $a = sc_proposal($pi);
    $b = sc_proposal($pi);
    $c = sc_proposal($pi);
    sc_score($a, $b, 0.85, true);
    sc_score($a, $c, 0.40, false);

    $response = $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/similarity-scores?flagged_only=1')
        ->assertOk();

    expect($response->json('data.data'))->toHaveCount(1);
});

test('min_score filters by threshold', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $a = sc_proposal($pi);
    $b = sc_proposal($pi);
    $c = sc_proposal($pi);
    sc_score($a, $b, 0.90, true);
    sc_score($a, $c, 0.30, false);

    $response = $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/similarity-scores?min_score=0.5')
        ->assertOk();

    expect($response->json('data.data'))->toHaveCount(1);
});

test('category filter scopes to the source proposal\'s category', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $researchA = sc_proposal($pi, 'research');
    $researchB = sc_proposal($pi, 'research');
    $communityA = sc_proposal($pi, 'community_engagement');
    $communityB = sc_proposal($pi, 'community_engagement');
    sc_score($researchA, $researchB, 0.85, true);
    sc_score($communityA, $communityB, 0.85, true);

    $response = $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/similarity-scores?category=research')
        ->assertOk();

    expect($response->json('data.data'))->toHaveCount(1);
});

test('summary reports total, flagged, and critical counts', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $a = sc_proposal($pi);
    $b = sc_proposal($pi);
    $c = sc_proposal($pi);
    sc_score($a, $b, 0.85, true);
    sc_score($a, $c, 0.30, false);

    $response = $this->actingAs($pi, 'sanctum')->getJson('/api/v1/similarity-scores')->assertOk();

    expect($response->json('summary.total'))->toBe(2)
        ->and($response->json('summary.flagged'))->toBe(1)
        ->and($response->json('summary.critical'))->toBe(1);
});
