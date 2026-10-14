<?php

use App\Models\BudgetRequest;
use App\Models\College;
use App\Models\Department;
use App\Models\FormTemplate;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use Database\Seeders\FormTemplateSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new FormTemplateSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function brh_college(string $label = 'A'): College
{
    return College::create(['name' => "BRH College {$label} ".rand(), 'code' => 'BRH'.$label.rand(10000, 99999)]);
}

function brh_proposal(College $college, User $pi, string $category = 'research'): Proposal
{
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'BRHD'.rand(10000, 99999)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'Call', 'slug' => 'brh-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'BRH-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => 'P', 'status' => 'funded',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

function brh_request(Proposal $proposal, User $pi, string $status = 'submitted'): BudgetRequest
{
    return BudgetRequest::create([
        'proposal_id' => $proposal->id,
        'form_template_id' => FormTemplate::first()->id,
        'requested_by' => $pi->id,
        'total_amount' => 10000,
        'status' => $status,
        'funding_round' => 1,
    ]);
}

// ─── show() ──────────────────────────────────────────────────────────────────

test('PI can view their own budget request', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);
    $request = brh_request($proposal, $pi);

    $this->actingAs($pi, 'sanctum')
        ->getJson("/api/v1/budget-requests/{$request->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $request->id);
});

test('an unrelated PI cannot view someone else\'s budget request', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);
    $request = brh_request($proposal, $pi);

    $outsider = User::factory()->create();
    $outsider->assignRole('pi');

    $this->actingAs($outsider, 'sanctum')
        ->getJson("/api/v1/budget-requests/{$request->id}")
        ->assertStatus(403);
});

test('an active proposal member can view the budget request', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);
    $request = brh_request($proposal, $pi);

    $member = User::factory()->create();
    $member->assignRole('pi');
    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $member->id,
        'role' => 'co_investigator', 'status' => 'active', 'contribution_percentage' => 20,
        'joined_at' => now(),
    ]);

    $this->actingAs($member, 'sanctum')
        ->getJson("/api/v1/budget-requests/{$request->id}")
        ->assertOk();
});

test('college officer can view a budget request in their own college but not another college', function () {
    $collegeA = brh_college('A');
    $collegeB = brh_college('B');
    $pi = User::factory()->create(['college_id' => $collegeA->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($collegeA, $pi);
    $request = brh_request($proposal, $pi);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');
    $officerB = User::factory()->create(['college_id' => $collegeB->id]);
    $officerB->assignRole('college_officer');

    $this->actingAs($officerA, 'sanctum')
        ->getJson("/api/v1/budget-requests/{$request->id}")
        ->assertOk();

    $this->actingAs($officerB, 'sanctum')
        ->getJson("/api/v1/budget-requests/{$request->id}")
        ->assertStatus(403);
});

test('category officer is scoped to their category', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $researchProposal = brh_proposal($college, $pi, 'research');
    $researchRequest = brh_request($researchProposal, $pi);
    $communityProposal = brh_proposal($college, $pi, 'community_engagement');
    $communityRequest = brh_request($communityProposal, $pi);

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $this->actingAs($researchOfficer, 'sanctum')
        ->getJson("/api/v1/budget-requests/{$researchRequest->id}")
        ->assertOk();

    $this->actingAs($researchOfficer, 'sanctum')
        ->getJson("/api/v1/budget-requests/{$communityRequest->id}")
        ->assertStatus(403);
});

test('super_admin can view any budget request', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);
    $request = brh_request($proposal, $pi);

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->getJson("/api/v1/budget-requests/{$request->id}")
        ->assertOk();
});

// ─── listRequests() / budgetSummary() — same visibility rule, proposal-scoped ─

test('listRequests denies an unrelated user and allows the owner', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);
    brh_request($proposal, $pi);

    $outsider = User::factory()->create();
    $outsider->assignRole('pi');

    $this->actingAs($outsider, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/budget-requests")
        ->assertStatus(403);

    $this->actingAs($pi, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/budget-requests")
        ->assertOk();
});

test('budgetSummary denies an unrelated user and allows the owner', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);

    $outsider = User::factory()->create();
    $outsider->assignRole('pi');

    $this->actingAs($outsider, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/budget-summary")
        ->assertStatus(403);

    $this->actingAs($pi, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/budget-summary")
        ->assertOk();
});

// ─── index() scoping ─────────────────────────────────────────────────────────

test('index only returns budget requests the PI owns', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);
    $ownRequest = brh_request($proposal, $pi);

    $otherPi = User::factory()->create(['college_id' => $college->id]);
    $otherPi->assignRole('pi');
    $otherProposal = brh_proposal($college, $otherPi);
    brh_request($otherProposal, $otherPi);

    $response = $this->actingAs($pi, 'sanctum')->getJson('/api/v1/budget-requests')->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($ownRequest->id)
        ->and($ids)->toHaveCount(1);
});

test('index scopes a college officer to their own college only', function () {
    $collegeA = brh_college('A');
    $collegeB = brh_college('B');
    $piA = User::factory()->create(['college_id' => $collegeA->id]);
    $piA->assignRole('pi');
    $requestA = brh_request(brh_proposal($collegeA, $piA), $piA);

    $piB = User::factory()->create(['college_id' => $collegeB->id]);
    $piB->assignRole('pi');
    brh_request(brh_proposal($collegeB, $piB), $piB);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/budget-requests')->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($requestA->id)
        ->and($ids)->toHaveCount(1);
});

// ─── approve() college-stage scoping ────────────────────────────────────────

test('college officer can approve a submitted request in their own college', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);
    $request = brh_request($proposal, $pi, 'submitted');

    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/budget-requests/{$request->id}/approve", ['notes' => 'Looks good'])
        ->assertOk()
        ->assertJsonPath('data.status', 'college_approved');
});

test('college officer cannot approve a request from another college', function () {
    $collegeA = brh_college('A');
    $collegeB = brh_college('B');
    $pi = User::factory()->create(['college_id' => $collegeA->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($collegeA, $pi);
    $request = brh_request($proposal, $pi, 'submitted');

    $officerB = User::factory()->create(['college_id' => $collegeB->id]);
    $officerB->assignRole('college_officer');

    $this->actingAs($officerB, 'sanctum')
        ->postJson("/api/v1/budget-requests/{$request->id}/approve", ['notes' => 'x'])
        ->assertStatus(403);

    expect($request->fresh()->status)->toBe('submitted');
});

test('a plain PI cannot approve a budget request', function () {
    $college = brh_college();
    $pi = User::factory()->create(['college_id' => $college->id]);
    $pi->assignRole('pi');
    $proposal = brh_proposal($college, $pi);
    $request = brh_request($proposal, $pi, 'submitted');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/budget-requests/{$request->id}/approve", ['notes' => 'x'])
        ->assertStatus(403);
});
