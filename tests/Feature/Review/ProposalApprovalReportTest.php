<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalApprovalReport;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function par_makeProposal(string $status, string $category = 'research'): array
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'PR'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'PRD'.rand(10, 99)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'Call', 'slug' => 'pr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'PR-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $college];
}

test('a college_officer can report a proposal sitting in blind review as possibly mistakenly approved', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $response = $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", [
            'reason' => 'This looks like a duplicate of an already-funded proposal.',
        ]);

    $response->assertCreated();
    $this->assertDatabaseHas('proposal_approval_reports', [
        'proposal_id' => $proposal->id, 'reported_by' => $officer->id, 'status' => 'open',
    ]);
});

test('a college_officer can report a proposal that already passed blind review', function () {
    [$proposal, $college] = par_makeProposal('blind_review_passed');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", [
            'reason' => 'PI eligibility should be rechecked.',
        ])
        ->assertCreated();
});

test('a non-college_officer role cannot file an approval report', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'Trying to report as the wrong role.'])
        ->assertStatus(403);
});

test('a college_officer cannot report a proposal from a different college', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $otherCollege = College::create(['name' => 'Other '.rand(), 'code' => 'OC'.rand(10, 99)]);
    $officer = User::factory()->create(['college_id' => $otherCollege->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'Reporting a proposal outside my college.'])
        ->assertStatus(403);
});

test('a proposal not currently in blind review cannot be reported', function () {
    [$proposal, $college] = par_makeProposal('draft');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'Reporting a draft proposal.'])
        ->assertStatus(422);
});

test('a second open report cannot be filed while one is already open', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'First report on this proposal.'])
        ->assertCreated();

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'Second report on this proposal.'])
        ->assertStatus(422);
});

test('the reason is required and must be at least 10 characters', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'short'])
        ->assertStatus(422);
});

test('central_officer and the matching category officer can mark a report reviewed', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review', 'research');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'Needs a second look.'])->assertCreated();

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');
    $report = ProposalApprovalReport::where('proposal_id', $proposal->id)->firstOrFail();

    $response = $this->actingAs($researchOfficer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/review", ['resolution_notes' => 'Checked — approval stands.']);

    $response->assertOk();
    expect(ProposalApprovalReport::find($report->id)->status)->toBe('reviewed');
});

test('a college_officer cannot mark a report reviewed', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'Needs a second look.'])->assertCreated();

    $report = ProposalApprovalReport::where('proposal_id', $proposal->id)->firstOrFail();

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/approval-reports/{$report->id}/review", [])
        ->assertStatus(403);
});

test('reports for a proposal are listed newest first with reporter and reviewer names', function () {
    [$proposal, $college] = par_makeProposal('under_blind_review');
    $officer = User::factory()->create(['name' => 'Officer One', 'college_id' => $college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/approval-reports", ['reason' => 'Needs a second look.'])->assertCreated();

    $response = $this->actingAs($officer, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}/approval-reports");

    $response->assertOk();
    expect($response->json('data.0.reported_by.name'))->toBe('Officer One')
        ->and($response->json('data.0.status'))->toBe('open');
});
