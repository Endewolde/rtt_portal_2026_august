<?php

use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\BudgetMilestone;
use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Models\College;
use App\Models\Department;
use App\Models\FormTemplate;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\BudgetRequestService;
use App\Services\DisbursementService;
use App\Services\SignatureService;
use Database\Seeders\FormTemplateSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new FormTemplateSeeder)->run();
    Storage::fake('private');

    $college = College::create(['name' => 'Access College', 'code' => 'FA'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'FAD'.rand(10000, 99999)]);
    $this->otherCollege = College::create(['name' => 'Other College', 'code' => 'FO'.rand(10000, 99999)]);

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $this->pi->assignRole('staff');
    $this->coI = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $this->coI->assignRole('staff');
    $this->stranger = User::factory()->create();
    $this->stranger->assignRole('staff');
    $this->finance = User::factory()->create(['college_id' => $college->id]);
    $this->finance->assignRole('finance_officer');
    $this->otherCollegeOfficer = User::factory()->create(['college_id' => $this->otherCollege->id]);
    $this->otherCollegeOfficer->assignRole('college_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'fa-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->proposal = Proposal::create([
        'tracker_number' => 'FA-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Access project', 'status' => 'funded', 'pi_user_id' => $this->pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $this->pi->id,
        'contract_status' => 'approved', 'contract_signed_at' => now(), 'contract_signed_by' => $this->central->id,
    ]);
    foreach ([[$this->pi, 'pi'], [$this->coI, 'co_investigator']] as [$member, $role]) {
        ProposalMember::create(['proposal_id' => $this->proposal->id, 'user_id' => $member->id, 'role' => $role, 'status' => 'active', 'contribution_percentage' => 50, 'joined_at' => now()]);
    }
    Award::create(['proposal_id' => $this->proposal->id, 'awarded_amount' => 100000, 'approved_by' => $this->central->id, 'approved_at' => now(), 'grant_reference' => 'GR-FA']);
});

/** A budget request taken through signing and approval, ready to be paid. */
function finAccess_approvedRequest(object $t): BudgetRequest
{
    BudgetAllocation::create([
        'college_id' => $t->proposal->college_id, 'proposal_id' => $t->proposal->id, 'fiscal_year' => '2026',
        'total_amount' => 100000, 'allocated_amount' => 0, 'remaining_balance' => 100000, 'allocation_type' => 'proposal',
        'status' => 'approved', 'approved_by' => $t->central->id, 'approved_at' => now(), 'allocated_by' => $t->central->id,
    ]);
    $template = FormTemplate::where('name', 'Research Budget Request')->first();
    $request = app(BudgetRequestService::class)->create($t->proposal, $template->id, [['category' => 'Personnel', 'description' => 'RA', 'amount' => 30000, 'justification' => null]], $t->pi);
    app(SignatureService::class)->sign($request, $t->pi, '127.0.0.1');
    app(SignatureService::class)->sign($request, $t->coI, '127.0.0.2');
    app(BudgetRequestService::class)->submit($request->fresh(), $t->pi);
    $request->fresh()->update(['status' => 'approved']);

    return $request->fresh();
}

test('only allocators within scope can create or edit an allocation', function () {
    $this->actingAs($this->stranger, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/quick-allocate", ['fiscal_year' => '2026'])
        ->assertForbidden();

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/quick-allocate", ['fiscal_year' => '2026'])
        ->assertCreated();

    $allocation = BudgetAllocation::where('proposal_id', $this->proposal->id)->firstOrFail();
    $this->actingAs($this->stranger, 'sanctum')
        ->patchJson("/api/v1/budget-allocations/{$allocation->id}", ['amount' => 1])
        ->assertForbidden();
    expect((float) $allocation->fresh()->total_amount)->toBe(100000.0);
});

test('only finance within scope can record a disbursement', function () {
    $request = finAccess_approvedRequest($this);

    $this->actingAs($this->pi, 'sanctum')
        ->postJson('/api/v1/disbursements', ['budget_request_id' => $request->id, 'amount' => 30000])
        ->assertForbidden();

    $this->actingAs($this->finance, 'sanctum')
        ->postJson('/api/v1/disbursements', ['budget_request_id' => $request->id, 'amount' => 99999999])
        ->assertUnprocessable();

    $this->actingAs($this->finance, 'sanctum')
        ->postJson('/api/v1/disbursements', ['budget_request_id' => $request->id, 'amount' => 30000])
        ->assertCreated();
});

test('only the project team can settle, once, without choosing a file path', function () {
    $request = finAccess_approvedRequest($this);
    app(DisbursementService::class)->disburse($request, 30000, ['transaction_id' => 'TXN'], $this->finance);

    $this->actingAs($this->stranger, 'sanctum')
        ->postJson('/api/v1/settlements', ['budget_request_id' => $request->id, 'total_spent' => 30000])
        ->assertForbidden();

    $this->actingAs($this->coI, 'sanctum')
        ->postJson('/api/v1/settlements', ['budget_request_id' => $request->id, 'total_spent' => 29000, 'unspent_amount' => 1000, 'expense_report_path' => '../../.env'])
        ->assertCreated();

    expect(BudgetSettlement::firstOrFail()->expense_report_path)->toBeNull();

    $this->actingAs($this->pi, 'sanctum')
        ->postJson('/api/v1/settlements', ['budget_request_id' => $request->id, 'total_spent' => 30000])
        ->assertUnprocessable();
});

test('expense reports are attached and opened only by those allowed', function () {
    $request = finAccess_approvedRequest($this);
    app(DisbursementService::class)->disburse($request, 30000, ['transaction_id' => 'TXN'], $this->finance);
    $settlement = BudgetSettlement::create(['budget_request_id' => $request->id, 'submitted_by' => $this->pi->id, 'status' => 'submitted', 'total_spent' => 30000, 'unspent_amount' => 0]);
    $pdf = fn () => UploadedFile::fake()->create('report.pdf', 20, 'application/pdf');

    $this->actingAs($this->stranger, 'sanctum')
        ->post("/api/v1/settlements/{$settlement->id}/upload-report", ['file' => $pdf()], ['Accept' => 'application/json'])
        ->assertForbidden();

    $this->actingAs($this->pi, 'sanctum')
        ->post("/api/v1/settlements/{$settlement->id}/upload-report", ['file' => $pdf()], ['Accept' => 'application/json'])
        ->assertOk();

    $this->actingAs($this->stranger, 'sanctum')->get("/api/v1/settlements/{$settlement->id}/download-report")->assertForbidden();
    $this->actingAs($this->otherCollegeOfficer, 'sanctum')->get("/api/v1/settlements/{$settlement->id}/download-report")->assertForbidden();
    $this->actingAs($this->coI, 'sanctum')->get("/api/v1/settlements/{$settlement->id}/download-report")->assertOk();
    $this->actingAs($this->finance, 'sanctum')->get("/api/v1/settlements/{$settlement->id}/download-report")->assertOk();

    $settlement->update(['status' => 'college_verified']);
    $this->actingAs($this->pi, 'sanctum')
        ->post("/api/v1/settlements/{$settlement->id}/upload-report", ['file' => $pdf()], ['Accept' => 'application/json'])
        ->assertUnprocessable();
});

test('settlement stats count only what the user can see', function () {
    $request = finAccess_approvedRequest($this);
    BudgetSettlement::create(['budget_request_id' => $request->id, 'submitted_by' => $this->pi->id, 'status' => 'submitted', 'total_spent' => 1, 'unspent_amount' => 0]);

    $this->actingAs($this->stranger, 'sanctum')->getJson('/api/v1/settlements/stats')->assertOk()->assertJsonPath('data.total', 0);
    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/settlements/stats')->assertOk()->assertJsonPath('data.submitted', 1);
});

test('milestones load in one call and cannot be edited through another project', function () {
    $milestone = BudgetMilestone::create(['proposal_id' => $this->proposal->id, 'title' => 'Data collected', 'status' => 'pending', 'sort_order' => 1, 'created_by' => $this->central->id]);
    $otherProject = $this->proposal->replicate(['tracker_number']);
    $otherProject->tracker_number = 'FA-OTHER';
    $otherProject->pi_user_id = $this->stranger->id;
    $otherProject->save();

    $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/budget-milestones')
        ->assertOk()
        ->assertJsonFragment(['title' => 'Data collected']);

    $this->actingAs($this->central, 'sanctum')
        ->putJson("/api/v1/proposals/{$otherProject->id}/milestones/{$milestone->id}", ['status' => 'completed'])
        ->assertNotFound();

    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/budget-milestones')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('the hover card shows a project’s full money picture to those allowed', function () {
    $request = finAccess_approvedRequest($this);
    app(DisbursementService::class)->disburse($request, 30000, ['transaction_id' => 'TXN'], $this->finance);
    BudgetMilestone::create(['proposal_id' => $this->proposal->id, 'title' => 'Late one', 'status' => 'pending', 'due_date' => now()->subDays(3), 'sort_order' => 1, 'created_by' => $this->central->id]);

    $this->actingAs($this->finance, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/finance-card")
        ->assertOk()
        ->assertJsonPath('data.tracker_number', $this->proposal->tracker_number)
        ->assertJsonPath('data.pi.email', $this->pi->email)
        ->assertJsonPath('data.award.grant_reference', 'GR-FA')
        ->assertJsonPath('data.allocation.status', 'approved')
        ->assertJsonPath('data.money.awarded', 100000)
        ->assertJsonPath('data.money.disbursed', 30000)
        ->assertJsonPath('data.money.remaining', 70000)
        ->assertJsonPath('data.rounds.0.round', 1)
        ->assertJsonPath('data.milestones.overdue', 1);

    $this->actingAs($this->coI, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/finance-card")->assertOk();
    $this->actingAs($this->stranger, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/finance-card")->assertForbidden();
    $this->actingAs($this->otherCollegeOfficer, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/finance-card")->assertForbidden();
});
