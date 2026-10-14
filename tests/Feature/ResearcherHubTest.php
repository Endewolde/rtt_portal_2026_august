<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\ResearchOutput;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hub_base(): array
{
    $college = College::create(['name' => 'Hub C '.rand(), 'code' => 'HC'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'HD', 'code' => 'HD'.rand(10000, 99999)]);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Hub Call', 'slug' => 'hub-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(2)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'HUB-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'Hub Proposal',
        'status' => 'submitted',
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);

    return compact('pi', 'admin', 'college', 'call', 'proposal');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('unauthenticated user cannot access researcher hub API', function () {
    $this->getJson('/api/v1/researcher-hub')->assertUnauthorized();
});

test('authenticated user gets researcher hub data structure', function () {
    ['pi' => $pi] = hub_base();

    $res = $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/researcher-hub')
        ->assertOk();

    $res->assertJsonStructure([
        'data' => [
            'proposals',
            'reviewAssignments',
            'upcomingDeadlines',
            'researchOutputs' => [
                'journal_article', 'conference_paper', 'book', 'patent',
                'software', 'prototype', 'community_impact', 'technology_transfer',
            ],
            'budgetSummary' => ['awarded', 'disbursed', 'settled'],
        ],
    ]);
});

test('proposals includes proposals where user is PI with role=pi', function () {
    ['pi' => $pi, 'proposal' => $proposal] = hub_base();

    $res = $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/researcher-hub')
        ->assertOk();

    $proposals = $res->json('data.proposals');
    expect($proposals)->toHaveCount(1)
        ->and($proposals[0]['id'])->toBe($proposal->id)
        ->and($proposals[0]['role'])->toBe('pi');
});

test('proposals includes co-investigator proposals with role=co_investigator', function () {
    ['pi' => $pi, 'proposal' => $proposal, 'admin' => $admin] = hub_base();

    $coPI = User::factory()->create();
    $coPI->assignRole('pi');

    ProposalMember::create([
        'proposal_id' => $proposal->id,
        'user_id' => $coPI->id,
        'role' => 'co_investigator',
        'status' => 'active',
        'joined_at' => now(),
    ]);

    $res = $this->actingAs($coPI, 'sanctum')
        ->getJson('/api/v1/researcher-hub')
        ->assertOk();

    $proposals = $res->json('data.proposals');
    expect(collect($proposals)->where('role', 'co_investigator'))->not->toBeEmpty();
});

test('review assignments returns only pending and in_progress assignments', function () {
    ['pi' => $pi, 'proposal' => $proposal, 'call' => $call] = hub_base();

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $evalType = EvaluationType::create(['name' => 'blind_review', 'label' => 'Blind Review', 'is_active' => true]);

    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'assigned_by' => $pi->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'pending',
        'assigned_at' => now(),
        'due_date' => now()->addDays(7)->toDateString(),
    ]);
    $proposal2 = Proposal::create([
        'tracker_number' => 'HUB2-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'Hub Proposal 2',
        'status' => 'under_blind_review',
        'pi_user_id' => $pi->id,
        'college_id' => $pi->college_id,
        'department_id' => $pi->department_id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);

    ReviewAssignment::create([
        'proposal_id' => $proposal2->id,
        'reviewer_id' => $reviewer->id,
        'assigned_by' => $pi->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'submitted',
        'assigned_at' => now(),
        'submitted_at' => now(),
    ]);

    $res = $this->actingAs($reviewer, 'sanctum')
        ->getJson('/api/v1/researcher-hub')
        ->assertOk();

    expect($res->json('data.reviewAssignments'))->toHaveCount(1);
});

test('upcoming deadlines includes active proposal calls', function () {
    ['admin' => $admin, 'pi' => $pi] = hub_base();

    ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Future Call', 'slug' => 'future-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addDays(5)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $res = $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/researcher-hub')
        ->assertOk();

    $types = collect($res->json('data.upcomingDeadlines'))->pluck('type');
    expect($types)->toContain('proposal_call');
});

test('research output counts are grouped by type with zeros for missing types', function () {
    ['pi' => $pi, 'proposal' => $proposal] = hub_base();

    ResearchOutput::create(['proposal_id' => $proposal->id, 'output_type' => 'journal_article', 'title' => 'P1', 'recorded_by' => $pi->id]);
    ResearchOutput::create(['proposal_id' => $proposal->id, 'output_type' => 'journal_article', 'title' => 'P2', 'recorded_by' => $pi->id]);
    ResearchOutput::create(['proposal_id' => $proposal->id, 'output_type' => 'patent', 'title' => 'Pat1', 'recorded_by' => $pi->id]);

    $res = $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/researcher-hub')
        ->assertOk();

    expect($res->json('data.researchOutputs.journal_article'))->toBe(2)
        ->and($res->json('data.researchOutputs.patent'))->toBe(1)
        ->and($res->json('data.researchOutputs.software'))->toBe(0);
});

test('web route /researcher-hub returns 200', function () {
    $this->get('/researcher-hub')->assertStatus(200);
});
