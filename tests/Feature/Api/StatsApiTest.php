<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// The 2026-2027 academic year is seeded by the app_settings migration as
// `current_academic_year`, so proposals below use that year to land in the stat.
function stats_makeProposal(ProposalCall $call, College $college, Department $department, User $pi, string $status, ?string $submittedAt, ?string $validatedAt, string $category = 'research'): Proposal
{
    return Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => $category,
        'title' => 'Stats Proposal',
        'status' => $status,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $department->id,
        'academic_year' => '2026-2027',
        'created_by' => $pi->id,
        'submitted_at' => $submittedAt,
        'validated_at' => $validatedAt,
    ]);
}

test('total_proposals counts everything submitted this year and does not shrink when a proposal is validated', function () {
    $college = College::factory()->create();
    $department = Department::factory()->create(['college_id' => $college->id]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $department->id]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call',
        'slug' => 'stats-call-'.rand(10000, 99999), 'start_date' => now()->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(), 'status' => 'active',
        'is_open' => true, 'created_by' => $pi->id,
    ]);

    stats_makeProposal($call, $college, $department, $pi, 'submitted', now(), null);
    stats_makeProposal($call, $college, $department, $pi, 'validated', now(), now());
    stats_makeProposal($call, $college, $department, $pi, 'under_blind_review', now(), now());
    // A draft was never submitted, so it must not be counted.
    stats_makeProposal($call, $college, $department, $pi, 'draft', null, null);

    $response = $this->getJson('/api/v1/stats');

    $response->assertOk();
    $response->assertJsonPath('data.total_proposals', 3);
    $response->assertJsonPath('data.validated', 2);
    $response->assertJsonPath('data.validated_rate', 67);
});

test('validated_by_category breaks the validated count down per proposal category', function () {
    $college = College::factory()->create();
    $department = Department::factory()->create(['college_id' => $college->id]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $department->id]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call',
        'slug' => 'stats-call-'.rand(10000, 99999), 'start_date' => now()->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(), 'status' => 'active',
        'is_open' => true, 'created_by' => $pi->id,
    ]);

    stats_makeProposal($call, $college, $department, $pi, 'validated', now(), now(), 'research');
    stats_makeProposal($call, $college, $department, $pi, 'validated', now(), now(), 'research');
    stats_makeProposal($call, $college, $department, $pi, 'under_blind_review', now(), now(), 'community_engagement');
    // Not yet validated — must not count toward any category.
    stats_makeProposal($call, $college, $department, $pi, 'submitted', now(), null, 'technology_transfer');

    $response = $this->getJson('/api/v1/stats');

    $response->assertOk();
    $byCategory = collect($response->json('data.validated_by_category'))->keyBy('category');

    expect($byCategory['research']['count'])->toBe(2);
    expect($byCategory['community_engagement']['count'])->toBe(1);
    // technology_transfer always appears (even at zero) so the card layout stays stable.
    expect($byCategory['technology_transfer']['count'])->toBe(0);
});
