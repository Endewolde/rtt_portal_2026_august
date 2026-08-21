<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\ProposalValidationService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    $this->service = app(ProposalValidationService::class);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSubmittedProposal(string $category = 'research'): Proposal
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'Test College', 'code' => 'TC-'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'Dept', 'code' => 'D-'.rand(10, 99)]);

    $call = ProposalCall::create([
        'academic_year' => '2026',
        'category' => $category,
        'title' => 'Test Call',
        'slug' => 'test-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active',
        'is_open' => true,
        'created_by' => $central->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'TRK-'.rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'category' => $category,
        'title' => 'Test Proposal',
        'status' => 'submitted',
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
        'submitted_at' => now(),
    ]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('central office can approve submitted proposal and status becomes validated', function () {
    $validator = User::factory()->create();
    $validator->assignRole('central_officer');

    $proposal = makeSubmittedProposal();

    $result = $this->service->approve($proposal, $validator);

    expect($result->status)->toBe('validated');
    expect($result->validated_at)->not->toBeNull();
});

test('central office can return proposal for correction and status becomes draft', function () {
    $validator = User::factory()->create();
    $validator->assignRole('central_officer');

    $proposal = makeSubmittedProposal();

    $result = $this->service->returnForCorrection($proposal, $validator, 'Missing budget details.');

    expect($result->status)->toBe('draft');
});

test('central office can reject proposal and status becomes rejected', function () {
    $validator = User::factory()->create();
    $validator->assignRole('central_officer');

    $proposal = makeSubmittedProposal();

    $result = $this->service->reject($proposal, $validator, 'Not aligned with objectives.');

    expect($result->status)->toBe('rejected');
});

test('rejected proposal has rejection_reason and rejected_at set', function () {
    $validator = User::factory()->create();
    $validator->assignRole('central_officer');

    $proposal = makeSubmittedProposal();

    $this->service->reject($proposal, $validator, 'Out of scope.');

    $proposal->refresh();
    expect($proposal->rejection_reason)->toBe('Out of scope.')
        ->and($proposal->rejected_at)->not->toBeNull();
});

test('returned proposal has rejection_reason set', function () {
    $validator = User::factory()->create();
    $validator->assignRole('central_officer');

    $proposal = makeSubmittedProposal();

    $this->service->returnForCorrection($proposal, $validator, 'Please revise the methodology.');

    $proposal->refresh();
    expect($proposal->rejection_reason)->toBe('Please revise the methodology.');
});

test('PI cannot validate a proposal — throws AuthorizationException', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $proposal = makeSubmittedProposal();

    expect(fn () => $this->service->approve($proposal, $pi))
        ->toThrow(AuthorizationException::class);
});

test('validation queue is scoped to the officer\'s category', function () {
    $researchProposal = makeSubmittedProposal('research');
    $communityProposal = makeSubmittedProposal('community_engagement');

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')
        ->getJson('/api/v1/proposals/validation-queue');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($researchProposal->id);
    expect($ids)->not->toContain($communityProposal->id);
});

test('validation queue is unscoped for central officers across categories', function () {
    $researchProposal = makeSubmittedProposal('research');
    $communityProposal = makeSubmittedProposal('community_engagement');

    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $response = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/proposals/validation-queue');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($researchProposal->id);
    expect($ids)->toContain($communityProposal->id);
});
