<?php

use App\Models\College;
use App\Models\DeadlineExtensionRequest;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function ac_makeBase(): array
{
    $college = College::create(['name' => 'AC College '.rand(), 'code' => 'AC'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'AD'.rand(10, 99)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'AC Call', 'slug' => 'ac-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return [$college, $dept, $central, $call];
}

function ac_proposal(College $college, Department $dept, ProposalCall $call, string $status): Proposal
{
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return Proposal::create([
        'tracker_number' => 'AC-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'AC Proposal',
        'status' => $status,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);
}

test('open_defence_queue counts proposals awaiting scheduling as well as ones already under defence', function () {
    [$college, $dept, $central, $call] = ac_makeBase();
    ac_proposal($college, $dept, $call, 'blind_review_passed');
    ac_proposal($college, $dept, $call, 'blind_review_passed');
    ac_proposal($college, $dept, $call, 'under_open_defence');
    ac_proposal($college, $dept, $call, 'under_blind_review'); // must not be counted

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.open_defence_queue'))->toBe(3);
});

test('central_eval_queue matches exactly what /admin/central-evaluation displays (status=accepted)', function () {
    [$college, $dept, $central, $call] = ac_makeBase();
    ac_proposal($college, $dept, $call, 'accepted');
    ac_proposal($college, $dept, $call, 'accepted');
    // These must NOT inflate the central-evaluation badge — they haven't reached
    // that phase yet, and CentralEvaluationController::index() never shows them.
    ac_proposal($college, $dept, $call, 'blind_review_passed');
    ac_proposal($college, $dept, $call, 'under_open_defence');
    ac_proposal($college, $dept, $call, 'funded');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.central_eval_queue'))->toBe(2);
});

test('proposal_funding_queue matches exactly what /admin/funding displays (status=funded)', function () {
    [$college, $dept, $central, $call] = ac_makeBase();
    ac_proposal($college, $dept, $call, 'funded');
    ac_proposal($college, $dept, $call, 'funded');
    // These must NOT inflate the funding badge — 'accepted' hasn't been funded yet
    // (that's central_eval_queue's job), and ProposalFunding.jsx never shows them.
    ac_proposal($college, $dept, $call, 'accepted');
    ac_proposal($college, $dept, $call, 'midterm_evaluation');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.proposal_funding_queue'))->toBe(2);
});

test('overdue_reviews only counts a college officer\'s own college', function () {
    [$collegeA, $deptA, $central, $callA] = ac_makeBase();
    $collegeB = College::create(['name' => 'AC College B '.rand(), 'code' => 'AB'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'ABD'.rand(10, 99)]);
    $type = EvaluationType::create(['name' => 'blind_review_ac_'.rand(1000, 9999), 'label' => 'Blind Review', 'proposal_category' => 'research', 'is_active' => true]);

    $reviewerA = User::factory()->create();
    $reviewerA->assignRole('reviewer');
    $proposalA = ac_proposal($collegeA, $deptA, $callA, 'under_blind_review');
    ReviewAssignment::create([
        'proposal_id' => $proposalA->id, 'reviewer_id' => $reviewerA->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $central->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->subDays(3)->toDateString(),
    ]);

    $reviewerB = User::factory()->create();
    $reviewerB->assignRole('reviewer');
    $proposalB = ac_proposal($collegeB, $deptB, $callA, 'under_blind_review');
    ReviewAssignment::create([
        'proposal_id' => $proposalB->id, 'reviewer_id' => $reviewerB->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $central->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->subDays(3)->toDateString(),
    ]);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.overdue_reviews'))->toBe(1);
});

test('ongoing_awaiting_midterm counts funded proposals with no midterm evaluation yet, scoped by college', function () {
    [$collegeA, $deptA, $central, $callA] = ac_makeBase();
    $collegeB = College::create(['name' => 'AC College E '.rand(), 'code' => 'AE'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'AED'.rand(10, 99)]);

    ac_proposal($collegeA, $deptA, $callA, 'funded');
    // Not counted: already has a midterm evaluation scheduled.
    $withMidterm = ac_proposal($collegeA, $deptA, $callA, 'funded');
    MidtermEvaluation::create([
        'proposal_id' => $withMidterm->id, 'evaluation_date' => now()->toDateString(),
        'status' => 'scheduled', 'scheduled_by' => $central->id,
    ]);
    // Not counted: different college.
    ac_proposal($collegeB, $deptB, $callA, 'funded');

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.ongoing_awaiting_midterm'))->toBe(1);
});

test('contracts_pending_review counts only contract_status=pending, scoped by college', function () {
    [$collegeA, $deptA, $central, $callA] = ac_makeBase();
    $collegeB = College::create(['name' => 'AC College F '.rand(), 'code' => 'AF'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'AFD'.rand(10, 99)]);

    ac_proposal($collegeA, $deptA, $callA, 'funded')->update(['contract_status' => 'pending']);
    ac_proposal($collegeA, $deptA, $callA, 'funded')->update(['contract_status' => 'approved']);
    // Not counted: different college.
    ac_proposal($collegeB, $deptB, $callA, 'funded')->update(['contract_status' => 'pending']);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.contracts_pending_review'))->toBe(1);
});

test('coi_conflicts_pending counts only unresolved reported conflicts, scoped by college', function () {
    [$collegeA, $deptA, $central, $callA] = ac_makeBase();
    $collegeB = College::create(['name' => 'AC College G '.rand(), 'code' => 'AG'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'AGD'.rand(10, 99)]);
    $type = EvaluationType::create(['name' => 'blind_review_coi_ac_'.rand(1000, 9999), 'label' => 'Blind Review', 'proposal_category' => 'research', 'is_active' => true]);
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $proposalA = ac_proposal($collegeA, $deptA, $callA, 'under_blind_review');
    ReviewAssignment::create([
        'proposal_id' => $proposalA->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $central->id, 'status' => 'pending', 'assigned_at' => now(),
        'coi_has_conflict' => true, 'coi_declared_at' => now(),
    ]);
    // Not counted: already resolved via reassignment.
    $resolvedProposal = ac_proposal($collegeA, $deptA, $callA, 'under_blind_review');
    ReviewAssignment::create([
        'proposal_id' => $resolvedProposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $central->id, 'status' => 'pending', 'assigned_at' => now(),
        'coi_has_conflict' => true, 'coi_declared_at' => now(), 'coi_resolved_at' => now(),
    ]);
    // Not counted: different college.
    $proposalB = ac_proposal($collegeB, $deptB, $callA, 'under_blind_review');
    ReviewAssignment::create([
        'proposal_id' => $proposalB->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $central->id, 'status' => 'pending', 'assigned_at' => now(),
        'coi_has_conflict' => true, 'coi_declared_at' => now(),
    ]);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.coi_conflicts_pending'))->toBe(1);
});

test('deadline_extensions_pending counts only pending requests, scoped by category', function () {
    [$college, $dept, $central, $researchCall] = ac_makeBase();
    $communityCall = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'community_engagement',
        'title' => 'AC Community Call', 'slug' => 'ac-community-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $researchProposal = ac_proposal($college, $dept, $researchCall, 'draft');
    DeadlineExtensionRequest::create([
        'proposal_id' => $researchProposal->id, 'requested_by' => $researchProposal->pi_user_id,
        'reason' => 'Need more time to finish the draft.', 'requested_until' => now()->addDays(10), 'status' => 'pending',
    ]);
    // Not counted: already resolved.
    $resolvedProposal = ac_proposal($college, $dept, $researchCall, 'draft');
    DeadlineExtensionRequest::create([
        'proposal_id' => $resolvedProposal->id, 'requested_by' => $resolvedProposal->pi_user_id,
        'reason' => 'Already resolved request.', 'requested_until' => now()->addDays(10),
        'status' => 'approved', 'resolved_at' => now(),
    ]);
    // Not counted: different category. ac_proposal() hardcodes category=research
    // regardless of the call passed in, so override it explicitly here.
    $communityProposal = ac_proposal($college, $dept, $communityCall, 'draft');
    $communityProposal->update(['category' => 'community_engagement']);
    DeadlineExtensionRequest::create([
        'proposal_id' => $communityProposal->id, 'requested_by' => $communityProposal->pi_user_id,
        'reason' => 'Different category, should not be counted.', 'requested_until' => now()->addDays(10), 'status' => 'pending',
    ]);

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.deadline_extensions_pending'))->toBe(1);
});

test('ethical_clearances_pending counts only submitted (awaiting review) proposals, scoped by college', function () {
    [$collegeA, $deptA, $central, $callA] = ac_makeBase();
    $collegeB = College::create(['name' => 'AC College H '.rand(), 'code' => 'AH'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'AHD'.rand(10, 99)]);

    $submittedProposal = ac_proposal($collegeA, $deptA, $callA, 'draft');
    $submittedProposal->update(['ethical_clearance_required' => true, 'ethical_clearance_status' => 'submitted']);
    // Not counted: still pending (no certificate submitted yet).
    $pendingProposal = ac_proposal($collegeA, $deptA, $callA, 'draft');
    $pendingProposal->update(['ethical_clearance_required' => true, 'ethical_clearance_status' => 'pending']);
    // Not counted: different college.
    $otherCollegeProposal = ac_proposal($collegeB, $deptB, $callA, 'draft');
    $otherCollegeProposal->update(['ethical_clearance_required' => true, 'ethical_clearance_status' => 'submitted']);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/action-counts');

    $response->assertOk();
    expect($response->json('data.ethical_clearances_pending'))->toBe(1);
});
