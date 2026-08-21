<?php

use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\BudgetRequest;
use App\Models\College;
use App\Models\Department;
use App\Models\Disbursement;
use App\Models\FormTemplate;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ResearchOutput;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function op_makeBase(): array
{
    $college = College::create(['name' => 'OP College '.rand(), 'code' => 'OP'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'OPD'.rand(10, 99)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2025-2026', 'category' => 'research',
        'title' => 'OP Call', 'slug' => 'op-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return [$college, $dept, $central, $call];
}

function op_proposal(College $college, Department $dept, ProposalCall $call, string $status, string $category = 'research'): Proposal
{
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return Proposal::create([
        'tracker_number' => 'OP-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => $category,
        'title' => 'OP Proposal',
        'status' => $status,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => $call->academic_year,
        'created_by' => $pi->id,
    ]);
}

test('unauthenticated user cannot access ongoing proposals', function () {
    $this->getJson('/api/v1/ongoing-proposals')->assertUnauthorized();
});

test('staff/PI cannot access even though they hold proposals.view_any', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals')
        ->assertForbidden();
});

test('funded, midterm_evaluation and completed proposals are included, not other statuses', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    op_proposal($college, $dept, $call, 'funded');
    op_proposal($college, $dept, $call, 'midterm_evaluation');
    op_proposal($college, $dept, $call, 'completed');
    op_proposal($college, $dept, $call, 'under_blind_review');
    op_proposal($college, $dept, $call, 'archived');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    expect($response->json('data.kpis.total_ongoing'))->toBe(3)
        ->and(collect($response->json('data.proposals.data'))->pluck('status')->all())
        ->toEqualCanonicalizing(['funded', 'midterm_evaluation', 'completed']);
});

test('a completed proposal is flagged needs_archiving and counted in awaiting_archive', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $completed = op_proposal($college, $dept, $call, 'completed');
    op_proposal($college, $dept, $call, 'funded');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    expect($response->json('data.kpis.awaiting_archive'))->toBe(1);

    $row = collect($response->json('data.proposals.data'))->firstWhere('id', $completed->id);
    expect($row['needs_archiving'])->toBeTrue();

    $filtered = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals?status=awaiting_archive');
    $ids = collect($filtered->json('data.proposals.data'))->pluck('id')->all();
    expect($ids)->toBe([$completed->id]);
});

test('central_officer can archive a completed proposal and it transitions to archived', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $proposal = op_proposal($college, $dept, $call, 'completed');

    $response = $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/archive");

    $response->assertOk();
    expect(Proposal::find($proposal->id)->status)->toBe('archived');
    $this->assertDatabaseHas('workflow_logs', ['proposal_id' => $proposal->id, 'to_stage' => 'archived']);
});

test('a college officer cannot archive even a proposal in their own college', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $proposal = op_proposal($college, $dept, $call, 'completed');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/archive")
        ->assertForbidden();

    expect(Proposal::find($proposal->id)->status)->toBe('completed');
});

test('archiving a proposal that is not yet completed is rejected', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $proposal = op_proposal($college, $dept, $call, 'funded');

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/archive")
        ->assertStatus(422);

    expect(Proposal::find($proposal->id)->status)->toBe('funded');
});

test('a college officer only sees ongoing proposals from their own college, even with a different college_id requested', function () {
    [$collegeA, $deptA, $central, $callA] = op_makeBase();
    $collegeB = College::create(['name' => 'OP College B '.rand(), 'code' => 'OB'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'OBD'.rand(10, 99)]);

    op_proposal($collegeA, $deptA, $callA, 'funded');
    op_proposal($collegeB, $deptB, $callA, 'funded');
    op_proposal($collegeB, $deptB, $callA, 'funded');

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals?college_id='.$collegeB->id);

    $response->assertOk();
    expect($response->json('data.kpis.total_ongoing'))->toBe(1);
    $collegeIds = collect($response->json('data.proposals.data'))->pluck('college_id')->unique();
    expect($collegeIds->all())->toBe([$collegeA->id]);
});

test('a category officer only ever sees their own category', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    op_proposal($college, $dept, $call, 'funded', 'research');
    op_proposal($college, $dept, $call, 'funded', 'technology_transfer');

    $researchOfficer = User::factory()->create();
    $researchOfficer->assignRole('research_officer');

    $response = $this->actingAs($researchOfficer, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals?category=technology_transfer');

    $response->assertOk();
    expect($response->json('data.kpis.total_ongoing'))->toBe(1);
    $categories = collect($response->json('data.proposals.data'))->pluck('category')->unique();
    expect($categories->all())->toBe(['research']);
});

test('awaiting_midterm counts only funded proposals with no midterm evaluation yet', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $awaiting = op_proposal($college, $dept, $call, 'funded');
    $inProgress = op_proposal($college, $dept, $call, 'funded');
    MidtermEvaluation::create([
        'proposal_id' => $inProgress->id, 'evaluation_date' => now()->toDateString(),
        'status' => 'scheduled', 'scheduled_by' => $central->id,
    ]);
    op_proposal($college, $dept, $call, 'midterm_evaluation');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    expect($response->json('data.kpis.total_ongoing'))->toBe(3)
        ->and($response->json('data.kpis.awaiting_midterm'))->toBe(1)
        ->and($response->json('data.kpis.in_midterm'))->toBe(2);

    $filtered = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals?status=awaiting_midterm');
    $ids = collect($filtered->json('data.proposals.data'))->pluck('id')->all();
    expect($ids)->toBe([$awaiting->id]);
});

test('budget allocation totals and utilization are summed correctly and scoped', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $p1 = op_proposal($college, $dept, $call, 'funded');
    BudgetAllocation::create([
        'college_id' => $college->id, 'proposal_id' => $p1->id, 'fiscal_year' => '2026',
        'total_amount' => 10000, 'allocated_amount' => 10000, 'remaining_balance' => 4000,
        'allocation_type' => 'proposal', 'status' => 'approved', 'allocated_by' => $central->id,
    ]);

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    expect((float) $response->json('data.kpis.total_budget_allocated'))->toBe(10000.0)
        ->and((float) $response->json('data.kpis.total_budget_utilized'))->toBe(6000.0);

    $row = collect($response->json('data.proposals.data'))->firstWhere('id', $p1->id);
    expect((float) $row['budget_allocated'])->toBe(10000.0)
        ->and((float) $row['budget_utilized'])->toBe(6000.0);
});

test('needs_midterm and needs_completion_workshop flags reflect the right eligibility', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $needsMidterm = op_proposal($college, $dept, $call, 'funded');

    $needsWorkshop = op_proposal($college, $dept, $call, 'midterm_evaluation');
    MidtermEvaluation::create([
        'proposal_id' => $needsWorkshop->id, 'evaluation_date' => now()->toDateString(),
        'status' => 'scored', 'recommendation' => 'continue', 'scheduled_by' => $central->id,
    ]);

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    $rows = collect($response->json('data.proposals.data'))->keyBy('id');

    expect($rows[$needsMidterm->id]['needs_midterm'])->toBeTrue()
        ->and($rows[$needsMidterm->id]['needs_completion_workshop'])->toBeFalse()
        ->and($rows[$needsWorkshop->id]['needs_midterm'])->toBeFalse()
        ->and($rows[$needsWorkshop->id]['needs_completion_workshop'])->toBeTrue();
});

test('sorting by pi name joins the users table correctly', function () {
    [$college, $dept, $central, $call] = op_makeBase();

    $piA = User::factory()->create(['name' => 'Aaron Adams', 'college_id' => $college->id, 'department_id' => $dept->id]);
    $piA->assignRole('pi');
    $piZ = User::factory()->create(['name' => 'Zoe Zimmerman', 'college_id' => $college->id, 'department_id' => $dept->id]);
    $piZ->assignRole('pi');

    Proposal::create([
        'tracker_number' => 'OP-'.rand(100000, 999999), 'proposal_call_id' => $call->id,
        'category' => 'research', 'title' => 'P1', 'status' => 'funded',
        'pi_user_id' => $piZ->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2025-2026', 'created_by' => $piZ->id,
    ]);
    Proposal::create([
        'tracker_number' => 'OP-'.rand(100000, 999999), 'proposal_call_id' => $call->id,
        'category' => 'research', 'title' => 'P2', 'status' => 'funded',
        'pi_user_id' => $piA->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2025-2026', 'created_by' => $piA->id,
    ]);

    $response = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals?sort=pi&direction=asc');

    $response->assertOk();
    $names = collect($response->json('data.proposals.data'))->pluck('pi.name')->all();
    expect($names)->toBe(['Aaron Adams', 'Zoe Zimmerman']);
});

test('a proposal from a prior academic year still funded is included regardless of current_academic_year', function () {
    [$college, $dept, $central] = op_makeBase();
    $oldCall = ProposalCall::create([
        'academic_year' => '2020-2021', 'category' => 'research',
        'title' => 'Old Call', 'slug' => 'op-old-'.rand(10000, 99999),
        'start_date' => now()->subYears(5)->toDateString(), 'end_date' => now()->subYears(5)->addMonths(3)->toDateString(),
        'status' => 'closed', 'is_open' => false, 'created_by' => $central->id,
    ]);
    op_proposal($college, $dept, $oldCall, 'funded');

    // No academic_year filter is applied anywhere in this endpoint — status-driven only.
    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    expect($response->json('data.kpis.total_ongoing'))->toBe(1);
});

test('a proposal awaiting midterm past the configured threshold is flagged overdue', function () {
    [$college, $dept, $central, $call] = op_makeBase();

    $overdue = op_proposal($college, $dept, $call, 'funded');
    Award::create([
        'proposal_id' => $overdue->id, 'grant_reference' => 'GR-'.rand(10000, 99999),
        'approved_by' => $central->id, 'approved_at' => now()->subDays(120), 'awarded_amount' => 5000,
    ]);

    $recent = op_proposal($college, $dept, $call, 'funded');
    Award::create([
        'proposal_id' => $recent->id, 'grant_reference' => 'GR-'.rand(10000, 99999),
        'approved_by' => $central->id, 'approved_at' => now()->subDays(10), 'awarded_amount' => 5000,
    ]);

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    expect($response->json('data.kpis.overdue_awaiting_midterm'))->toBe(1);

    $rows = collect($response->json('data.proposals.data'))->keyBy('id');
    expect($rows[$overdue->id]['is_overdue'])->toBeTrue()
        ->and($rows[$recent->id]['is_overdue'])->toBeFalse();

    $filtered = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals?status=overdue');
    $ids = collect($filtered->json('data.proposals.data'))->pluck('id')->all();
    expect($ids)->toBe([$overdue->id]);
});

test('the export endpoint downloads an xlsx file honoring the same filters and scoping as the list', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    op_proposal($college, $dept, $call, 'funded');
    op_proposal($college, $dept, $call, 'midterm_evaluation');

    $response = $this->actingAs($central, 'sanctum')->get('/api/v1/ongoing-proposals/export');

    $response->assertOk();
    $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('a non-allowed role cannot export ongoing proposals', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')
        ->get('/api/v1/ongoing-proposals/export')
        ->assertForbidden();
});

test('needs_contract reflects contract_status and is counted/filterable', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $approved = op_proposal($college, $dept, $call, 'funded');
    $approved->update(['contract_status' => 'approved']);
    $pending = op_proposal($college, $dept, $call, 'funded');
    $pending->update(['contract_status' => 'pending']);
    $notSubmitted = op_proposal($college, $dept, $call, 'funded');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    expect($response->json('data.kpis.needs_contract'))->toBe(2);

    $rows = collect($response->json('data.proposals.data'))->keyBy('id');
    expect($rows[$approved->id]['needs_contract'])->toBeFalse()
        ->and($rows[$pending->id]['needs_contract'])->toBeTrue()
        ->and($rows[$notSubmitted->id]['needs_contract'])->toBeTrue();

    $filtered = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals?status=needs_contract');
    $ids = collect($filtered->json('data.proposals.data'))->pluck('id')->all();
    expect($ids)->toEqualCanonicalizing([$pending->id, $notSubmitted->id]);
});

test('needs_disbursement reflects an approved budget request with no disbursement yet', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $template = FormTemplate::create(['name' => 'Budget Form', 'is_active' => true, 'created_by' => $central->id]);

    $awaitingDisbursement = op_proposal($college, $dept, $call, 'funded');
    $approvedRequest = BudgetRequest::create([
        'proposal_id' => $awaitingDisbursement->id, 'form_template_id' => $template->id,
        'requested_by' => $central->id, 'total_amount' => 5000, 'status' => 'approved',
    ]);

    $disbursed = op_proposal($college, $dept, $call, 'funded');
    $disbursedRequest = BudgetRequest::create([
        'proposal_id' => $disbursed->id, 'form_template_id' => $template->id,
        'requested_by' => $central->id, 'total_amount' => 5000, 'status' => 'approved',
    ]);
    Disbursement::create([
        'budget_request_id' => $disbursedRequest->id, 'disbursed_by' => $central->id,
        'amount' => 5000, 'disbursed_at' => now(),
    ]);

    $notYetApproved = op_proposal($college, $dept, $call, 'funded');
    BudgetRequest::create([
        'proposal_id' => $notYetApproved->id, 'form_template_id' => $template->id,
        'requested_by' => $central->id, 'total_amount' => 5000, 'status' => 'submitted',
    ]);

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    expect($response->json('data.kpis.needs_disbursement'))->toBe(1);

    $rows = collect($response->json('data.proposals.data'))->keyBy('id');
    expect($rows[$awaitingDisbursement->id]['needs_disbursement'])->toBeTrue()
        ->and($rows[$disbursed->id]['needs_disbursement'])->toBeFalse()
        ->and($rows[$notYetApproved->id]['needs_disbursement'])->toBeFalse();

    $filtered = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals?status=needs_disbursement');
    $ids = collect($filtered->json('data.proposals.data'))->pluck('id')->all();
    expect($ids)->toBe([$awaitingDisbursement->id]);
});

test('outputs_count reflects the number of recorded research outputs', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $withOutputs = op_proposal($college, $dept, $call, 'funded');
    ResearchOutput::create([
        'proposal_id' => $withOutputs->id, 'output_type' => 'journal_article',
        'title' => 'Output 1', 'recorded_by' => $central->id,
    ]);
    ResearchOutput::create([
        'proposal_id' => $withOutputs->id, 'output_type' => 'patent',
        'title' => 'Output 2', 'recorded_by' => $central->id,
    ]);
    $withoutOutputs = op_proposal($college, $dept, $call, 'funded');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/ongoing-proposals');

    $response->assertOk();
    $rows = collect($response->json('data.proposals.data'))->keyBy('id');
    expect($rows[$withOutputs->id]['outputs_count'])->toBe(2)
        ->and($rows[$withoutOutputs->id]['outputs_count'])->toBe(0);
});

test('a college_officer cannot grant a legacy proposal, only admin-core roles can', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $proposal = op_proposal($college, $dept, $call, 'under_blind_review');
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/grant-legacy", [
            'justification' => 'Actually funded externally in 2024.',
            'awarded_amount' => 10000,
        ])
        ->assertForbidden();

    expect(Proposal::find($proposal->id)->status)->toBe('under_blind_review');
});

test('a central_officer can grant a legacy proposal', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $proposal = op_proposal($college, $dept, $call, 'under_blind_review');

    $response = $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/grant-legacy", [
            'justification' => 'Actually funded externally in 2024.',
            'awarded_amount' => 10000,
        ]);

    $response->assertOk();
    expect(Proposal::find($proposal->id)->status)->toBe('funded');
});

test('an admin can grant a legacy proposal', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $proposal = op_proposal($college, $dept, $call, 'under_blind_review');
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/grant-legacy", [
            'justification' => 'Actually funded externally in 2024.',
            'awarded_amount' => 10000,
        ]);

    $response->assertOk();
    expect(Proposal::find($proposal->id)->status)->toBe('funded');
});

test('super_admin can grant a legacy proposal, which transitions it to funded and creates an award', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $proposal = op_proposal($college, $dept, $call, 'under_blind_review');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/grant-legacy", [
            'justification' => 'Actually funded externally before this system existed.',
            'awarded_amount' => 15000,
            'grant_reference' => 'LEGACY-GR-0001',
            'approved_at' => '2024-01-15',
        ]);

    $response->assertOk();
    expect(Proposal::find($proposal->id)->status)->toBe('funded');

    $this->assertDatabaseHas('awards', [
        'proposal_id' => $proposal->id,
        'grant_reference' => 'LEGACY-GR-0001',
        'awarded_amount' => 15000,
    ]);
    $this->assertDatabaseHas('workflow_logs', [
        'proposal_id' => $proposal->id,
        'from_stage' => 'under_blind_review',
        'action' => 'grant_legacy',
        'to_stage' => 'funded',
    ]);
    $this->assertDatabaseHas('audit_logs', [
        'auditable_id' => $proposal->id,
        'event' => 'proposal.grant_legacy',
    ]);

    // Immediately shows up on the ongoing dashboard.
    $listResponse = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/v1/ongoing-proposals');
    $ids = collect($listResponse->json('data.proposals.data'))->pluck('id')->all();
    expect($ids)->toContain($proposal->id);
});

test('granting a legacy proposal requires a justification of at least 10 characters', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $proposal = op_proposal($college, $dept, $call, 'draft');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/grant-legacy", [
            'justification' => 'too short',
            'awarded_amount' => 5000,
        ])
        ->assertStatus(422);

    expect(Proposal::find($proposal->id)->status)->toBe('draft');
});

test('a proposal that is already funded, ongoing, or archived cannot be granted again', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $funded = op_proposal($college, $dept, $call, 'funded');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$funded->id}/grant-legacy", [
            'justification' => 'Trying to grant an already-funded proposal.',
            'awarded_amount' => 5000,
        ])
        ->assertStatus(422);
});

test('a proposal that already has an award record cannot be granted again', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $proposal = op_proposal($college, $dept, $call, 'rejected');
    Award::create([
        'proposal_id' => $proposal->id, 'grant_reference' => 'GR-'.rand(10000, 99999),
        'approved_by' => $central->id, 'approved_at' => now(), 'awarded_amount' => 1000,
    ]);

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson("/api/v1/ongoing-proposals/{$proposal->id}/grant-legacy", [
            'justification' => 'This proposal already has an award somehow.',
            'awarded_amount' => 5000,
        ])
        ->assertStatus(422);
});

test('grantable search excludes proposals already funded/ongoing/archived and those with an existing award', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $eligible = op_proposal($college, $dept, $call, 'rejected');
    op_proposal($college, $dept, $call, 'funded');
    op_proposal($college, $dept, $call, 'archived');

    $hasAward = op_proposal($college, $dept, $call, 'under_blind_review');
    Award::create([
        'proposal_id' => $hasAward->id, 'grant_reference' => 'GR-'.rand(10000, 99999),
        'approved_by' => $central->id, 'approved_at' => now(), 'awarded_amount' => 1000,
    ]);

    $response = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/v1/ongoing-proposals/grantable');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id')->all();
    expect($ids)->toBe([$eligible->id]);
});

function op_nonLegacyGrantActor(College $college): User
{
    $officer = User::factory()->create(['college_id' => $college->id]);
    $officer->assignRole('college_officer');

    return $officer;
}

test('a role outside the admin core cannot search grantable proposals', function () {
    [$college, $dept, $central, $call] = op_makeBase();

    $this->actingAs(op_nonLegacyGrantActor($college), 'sanctum')
        ->getJson('/api/v1/ongoing-proposals/grantable')
        ->assertForbidden();
});

function op_csv(array $rows): UploadedFile
{
    $lines = ['tracker_number,awarded_amount,grant_reference,approved_at'];
    foreach ($rows as $r) {
        $lines[] = implode(',', [$r[0], $r[1], $r[2] ?? '', $r[3] ?? '']);
    }

    return UploadedFile::fake()->createWithContent('legacy.csv', implode("\n", $lines));
}

test('a role outside the admin core cannot access the bulk legacy grant import endpoints', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $proposal = op_proposal($college, $dept, $call, 'rejected');
    $actor = op_nonLegacyGrantActor($college);

    $this->actingAs($actor, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals/grant-legacy/import-template')
        ->assertForbidden();

    $this->actingAs($actor, 'sanctum')
        ->post('/api/v1/ongoing-proposals/grant-legacy/import', [
            'file' => op_csv([[$proposal->tracker_number, 5000]]),
            'justification' => 'Bulk migrating legacy grants.',
        ])
        ->assertForbidden();
});

test('super_admin can download the bulk legacy grant CSV template', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->get('/api/v1/ongoing-proposals/grant-legacy/import-template');

    $response->assertOk();
    $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
});

test('bulk import grants every eligible row and reports a shared justification', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $p1 = op_proposal($college, $dept, $call, 'rejected');
    $p2 = op_proposal($college, $dept, $call, 'draft');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->post('/api/v1/ongoing-proposals/grant-legacy/import', [
            'file' => op_csv([
                [$p1->tracker_number, 12000, 'LEGACY-0001', '2024-03-01'],
                [$p2->tracker_number, 8000],
            ]),
            'justification' => 'Bulk migrating FY2023 legacy grants recorded outside the system.',
        ]);

    $response->assertOk();
    expect($response->json('data.summary.total'))->toBe(2)
        ->and($response->json('data.summary.created'))->toBe(2)
        ->and($response->json('data.summary.errors'))->toBe(0);

    expect(Proposal::find($p1->id)->status)->toBe('funded')
        ->and(Proposal::find($p2->id)->status)->toBe('funded');

    $this->assertDatabaseHas('awards', ['proposal_id' => $p1->id, 'grant_reference' => 'LEGACY-0001', 'awarded_amount' => 12000]);
    $this->assertDatabaseHas('awards', ['proposal_id' => $p2->id, 'awarded_amount' => 8000]);
    $this->assertDatabaseHas('workflow_logs', ['proposal_id' => $p1->id, 'action' => 'grant_legacy']);
    $this->assertDatabaseHas('workflow_logs', ['proposal_id' => $p2->id, 'action' => 'grant_legacy']);
});

test('bulk import skips rows with an unknown tracker number, an ineligible status, or a duplicate grant reference, and grants the rest', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $eligible = op_proposal($college, $dept, $call, 'draft');
    $alreadyFunded = op_proposal($college, $dept, $call, 'funded');
    $dupeReferenceTarget = op_proposal($college, $dept, $call, 'rejected');
    $otherProposal = op_proposal($college, $dept, $call, 'rejected');
    Award::create([
        'proposal_id' => $otherProposal->id,
        'grant_reference' => 'TAKEN-REF', 'approved_by' => $central->id, 'approved_at' => now(), 'awarded_amount' => 1,
    ]);

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->post('/api/v1/ongoing-proposals/grant-legacy/import', [
            'file' => op_csv([
                ['NON-EXISTENT-TRACKER', 5000],
                [$alreadyFunded->tracker_number, 5000],
                [$dupeReferenceTarget->tracker_number, 5000, 'TAKEN-REF'],
                [$eligible->tracker_number, 5000],
            ]),
            'justification' => 'Bulk migrating legacy grants with some bad rows mixed in.',
        ]);

    $response->assertOk();
    expect($response->json('data.summary.created'))->toBe(1)
        ->and($response->json('data.summary.errors'))->toBe(3)
        ->and($response->json('data.summary.total'))->toBe(4);

    $errors = collect($response->json('data.errors'))->pluck('error', 'tracker_number');
    expect($errors['NON-EXISTENT-TRACKER'])->toContain('No proposal found')
        ->and($errors[$alreadyFunded->tracker_number])->toContain('already funded')
        ->and($errors[$dupeReferenceTarget->tracker_number])->toContain('already in use');

    expect(Proposal::find($eligible->id)->status)->toBe('funded')
        ->and(Proposal::find($dupeReferenceTarget->id)->status)->toBe('rejected');
});

test('bulk import rejects rows with a missing tracker or a non-numeric amount before touching the database', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $eligible = op_proposal($college, $dept, $call, 'draft');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->post('/api/v1/ongoing-proposals/grant-legacy/import', [
            'file' => op_csv([
                ['', 5000],
                [$eligible->tracker_number, 'not-a-number'],
            ]),
            'justification' => 'Testing malformed rows.',
        ]);

    $response->assertOk();
    expect($response->json('data.summary.created'))->toBe(0)
        ->and($response->json('data.summary.errors'))->toBe(2);

    expect(Proposal::find($eligible->id)->status)->toBe('draft');
});

test('bulk import requires a justification and a file', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $this->actingAs($superAdmin, 'sanctum')
        ->post('/api/v1/ongoing-proposals/grant-legacy/import', [])
        ->assertStatus(422);
});

function op_createLegacyPayload(array $overrides = []): array
{
    return array_merge([
        'title' => 'A fully paper-based historical grant',
        'category' => 'research',
        'academic_year' => '2022-2023',
        'justification' => 'Recorded from paper archives — never entered into the system.',
        'awarded_amount' => 20000,
        'abstract' => str_repeat('This proposal was recorded from paper archives. ', 3),
        'focus_area' => 'Agriculture & Food Systems',
        'research_type' => 'Applied Research',
        'duration_months' => 12,
    ], $overrides);
}

test('a role outside the admin core cannot create-and-grant a brand new legacy proposal', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $this->actingAs(op_nonLegacyGrantActor($college), 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
        ]))
        ->assertForbidden();
});

test('super_admin can create and grant a brand new proposal that never existed in the system', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
        ]));

    $response->assertOk();

    $proposal = Proposal::where('title', 'A fully paper-based historical grant')->firstOrFail();
    expect($proposal->status)->toBe('funded')
        ->and($proposal->tracker_number)->toStartWith('RES-2022-2023-')
        ->and($proposal->pi_user_id)->toBe($pi->id)
        ->and($proposal->college_id)->toBe($college->id)
        ->and($proposal->department_id)->toBe($dept->id);

    $this->assertDatabaseHas('awards', ['proposal_id' => $proposal->id, 'awarded_amount' => 20000]);
    $this->assertDatabaseHas('workflow_logs', ['proposal_id' => $proposal->id, 'action' => 'grant_legacy']);

    $reservedCall = ProposalCall::where('slug', 'legacy-manual-grants-research-2022-2023')->first();
    expect($reservedCall)->not->toBeNull()
        ->and($proposal->proposal_call_id)->toBe($reservedCall->id)
        ->and($reservedCall->is_open)->toBeFalse();
});

test('a second legacy creation for the same category and academic year reuses the same reserved call', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $this->actingAs($superAdmin, 'sanctum')->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
        'title' => 'First legacy proposal', 'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
    ]))->assertOk();

    $this->actingAs($superAdmin, 'sanctum')->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
        'title' => 'Second legacy proposal', 'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
    ]))->assertOk();

    expect(ProposalCall::where('slug', 'legacy-manual-grants-research-2022-2023')->count())->toBe(1);

    $p1 = Proposal::where('title', 'First legacy proposal')->firstOrFail();
    $p2 = Proposal::where('title', 'Second legacy proposal')->firstOrFail();
    expect($p1->proposal_call_id)->toBe($p2->proposal_call_id)
        ->and($p1->tracker_number)->not->toBe($p2->tracker_number);
});

test('creating a legacy proposal rejects a department that does not belong to the selected college', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $otherCollege = College::create(['name' => 'OP College Other '.rand(), 'code' => 'OO'.rand(10, 99)]);
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $otherCollege->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
        ]))
        ->assertStatus(422);
});

test('creating a legacy proposal rejects a selected user who does not hold the staff role', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $notStaff = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $notStaff->assignRole('college_officer');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $notStaff->id,
        ]))
        ->assertStatus(422);
});

test('creating a legacy proposal requires the core fields', function () {
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', [])
        ->assertStatus(422);
});

test('creating a legacy proposal persists the same basic-info fields the normal wizard collects', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
            'keywords' => 'legacy, paper archive, historical grant',
        ]));

    $response->assertOk();
    $proposal = Proposal::where('title', 'A fully paper-based historical grant')->firstOrFail();

    expect($proposal->keywords)->toBe('legacy, paper archive, historical grant')
        ->and($proposal->focus_area)->toBe('Agriculture & Food Systems')
        ->and($proposal->research_type)->toBe('Applied Research')
        ->and($proposal->duration_months)->toBe(12)
        ->and($proposal->abstract)->not->toBeNull();
});

test('creating a legacy proposal rejects an abstract under 100 characters', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
            'abstract' => 'Too short.',
        ]))
        ->assertStatus(422);
});

test('creating a legacy proposal does not persist research_type for a non-research category', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'title' => 'A community engagement legacy grant',
            'category' => 'community_engagement',
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
            'focus_area' => 'Health & Well-being',
            'research_type' => 'Applied Research',
        ]));

    $response->assertOk();
    $proposal = Proposal::where('title', 'A community engagement legacy grant')->firstOrFail();
    expect($proposal->research_type)->toBeNull();
});

test('creating a legacy proposal can attach co-investigators with the pi getting the remaining contribution', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');
    $coInv1 = User::factory()->create();
    $coInv1->assignRole('staff');
    $coInv2 = User::factory()->create();
    $coInv2->assignRole('staff');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
            'co_investigators' => [
                ['user_id' => $coInv1->id, 'contribution_percentage' => 30],
                ['user_id' => $coInv2->id, 'contribution_percentage' => 20],
            ],
        ]));

    $response->assertOk();
    $proposal = Proposal::where('title', 'A fully paper-based historical grant')->firstOrFail();

    $this->assertDatabaseHas('proposal_members', [
        'proposal_id' => $proposal->id, 'user_id' => $pi->id, 'role' => 'pi', 'contribution_percentage' => 50,
    ]);
    $this->assertDatabaseHas('proposal_members', [
        'proposal_id' => $proposal->id, 'user_id' => $coInv1->id, 'role' => 'co_investigator',
        'contribution_percentage' => 30, 'invitation_status' => 'accepted',
    ]);
    $this->assertDatabaseHas('proposal_members', [
        'proposal_id' => $proposal->id, 'user_id' => $coInv2->id, 'role' => 'co_investigator',
        'contribution_percentage' => 20, 'invitation_status' => 'accepted',
    ]);
});

test('creating a legacy proposal rejects the pi appearing in their own co-investigator list', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
            'co_investigators' => [['user_id' => $pi->id, 'contribution_percentage' => 10]],
        ]))
        ->assertStatus(422);
});

test('creating a legacy proposal rejects a duplicate co-investigator', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');
    $coInv = User::factory()->create();
    $coInv->assignRole('staff');

    $this->actingAs($superAdmin, 'sanctum')
        ->postJson('/api/v1/ongoing-proposals/grant-legacy/create', op_createLegacyPayload([
            'college_id' => $college->id, 'department_id' => $dept->id, 'pi_user_id' => $pi->id,
            'co_investigators' => [
                ['user_id' => $coInv->id, 'contribution_percentage' => 10],
                ['user_id' => $coInv->id, 'contribution_percentage' => 20],
            ],
        ]))
        ->assertStatus(422);
});

test('a role outside the admin core cannot list academic years for the legacy grant form', function () {
    [$college, $dept, $central, $call] = op_makeBase();

    $this->actingAs(op_nonLegacyGrantActor($college), 'sanctum')
        ->getJson('/api/v1/ongoing-proposals/grant-legacy/academic-years')
        ->assertForbidden();
});

test('super_admin sees distinct academic years already recorded on proposals, newest first', function () {
    [$college, $dept, $central, $call] = op_makeBase();
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    op_proposal($college, $dept, $call, 'draft');

    $oldCall = ProposalCall::create([
        'academic_year' => '2019-2020', 'category' => 'research',
        'title' => 'Old Call', 'slug' => 'op-old-'.rand(10000, 99999),
        'start_date' => now()->subYears(6)->toDateString(), 'end_date' => now()->subYears(6)->addMonths(3)->toDateString(),
        'status' => 'closed', 'is_open' => false, 'created_by' => $central->id,
    ]);
    op_proposal($college, $dept, $oldCall, 'draft');

    $response = $this->actingAs($superAdmin, 'sanctum')
        ->getJson('/api/v1/ongoing-proposals/grant-legacy/academic-years');

    $response->assertOk();
    expect($response->json('data'))->toBe(['2025-2026', '2019-2020']);
});
