<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ResearchImpact;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function ri_proposal(User $creator): Proposal
{
    $college = College::create(['name' => 'RI College '.rand(), 'code' => 'RI'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RID'.rand(10, 99)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ri-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $creator->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'RI-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'completed',
        'pi_user_id' => $creator->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $creator->id,
    ]);
}

test('a user without research_impacts.view_any is forbidden from listing', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->getJson('/api/v1/research-impacts')
        ->assertStatus(403);
});

test('an admin can record a research impact for a proposal', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $proposal = ri_proposal($admin);

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/research-impacts', [
            'proposal_id' => $proposal->id,
            'type' => 'publication',
            'title' => 'A great paper',
            'year' => 2026,
        ])
        ->assertCreated();

    expect(ResearchImpact::where('proposal_id', $proposal->id)->exists())->toBeTrue()
        ->and($response->json('data.title'))->toBe('A great paper');
});

test('a reviewer without research_impacts.create cannot record an impact', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $proposal = ri_proposal($admin);

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->postJson('/api/v1/research-impacts', [
            'proposal_id' => $proposal->id,
            'type' => 'publication',
            'title' => 'Should not be allowed',
        ])
        ->assertStatus(403);
});

test('index filters by type, year, and search query', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $proposal = ri_proposal($admin);

    $pub = ResearchImpact::create([
        'proposal_id' => $proposal->id, 'type' => 'publication', 'title' => 'Distinctive Paper Title',
        'year' => 2026, 'recorded_by' => $admin->id,
    ]);
    ResearchImpact::create([
        'proposal_id' => $proposal->id, 'type' => 'patent', 'title' => 'Unrelated Patent',
        'year' => 2024, 'recorded_by' => $admin->id,
    ]);

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/research-impacts?type=publication')
        ->assertOk();

    $ids = collect($response->json('data.data'))->pluck('id');
    expect($ids)->toContain($pub->id)->and($ids)->toHaveCount(1);
});

test('update and delete require their own permissions', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $proposal = ri_proposal($admin);
    $impact = ResearchImpact::create([
        'proposal_id' => $proposal->id, 'type' => 'publication', 'title' => 'Original Title',
        'recorded_by' => $admin->id,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/research-impacts/{$impact->id}", ['title' => 'Updated Title'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Updated Title');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/research-impacts/{$impact->id}")
        ->assertOk();

    expect(ResearchImpact::find($impact->id))->toBeNull();
});
