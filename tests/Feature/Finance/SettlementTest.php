<?php

use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Models\College;
use App\Models\Department;
use App\Models\FormSignature;
use App\Models\FormTemplate;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\BudgetRequestService;
use App\Services\BudgetSettlementService;
use App\Services\DisbursementService;
use App\Services\SignatureService;
use Database\Seeders\FormTemplateSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new FormTemplateSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sett_makeBase(): array
{
    $college = College::create(['name' => 'Sett College '.rand(), 'code' => 'ST'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'SD2'.rand(10, 99)]);

    $central       = User::factory()->create(); $central->assignRole('central_office');
    $pi            = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]); $pi->assignRole('pi');
    $coI           = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]); $coI->assignRole('pi');
    $collegeAdmin  = User::factory()->create(); $collegeAdmin->assignRole('college_admin');
    $finance       = User::factory()->create(); $finance->assignRole('finance');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'sett-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'Sett Proposal', 'status' => 'funded',
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $pi->id,
        'role' => 'pi', 'status' => 'active', 'contribution_percentage' => 50, 'joined_at' => now(),
    ]);
    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $coI->id,
        'role' => 'co_investigator', 'status' => 'active', 'contribution_percentage' => 50, 'joined_at' => now(),
    ]);

    // Award the proposal so its budget pool exists
    Award::create([
        'proposal_id'     => $proposal->id,
        'awarded_amount'  => 200000.00,
        'approved_by'     => $central->id,
        'approved_at'     => now(),
        'grant_reference' => 'GR-SETT-'.rand(1000, 9999),
    ]);

    // Create an approved budget allocation so PI can submit budget requests
    BudgetAllocation::create([
        'college_id'        => $college->id,
        'proposal_id'       => $proposal->id,
        'fiscal_year'       => '2026',
        'total_amount'      => 200000.00,
        'allocated_amount'  => 0,
        'remaining_balance' => 200000.00,
        'allocation_type'   => 'proposal',
        'status'            => 'approved',
        'approved_by'       => $central->id,
        'approved_at'       => now(),
        'allocated_by'      => $central->id,
    ]);

    return [$proposal, $pi, $coI, $collegeAdmin, $finance];
}

function sett_makeDisbursedRequest(array $base): array
{
    [$proposal, $pi, $coI, $collegeAdmin, $finance] = $base;

    $template = FormTemplate::where('name', 'Research Budget Request')->first();
    $items    = [['category' => 'Personnel', 'description' => 'RA', 'amount' => 50000, 'justification' => null]];

    $request = app(BudgetRequestService::class)->create($proposal, $template->id, $items, $pi);

    // Sign all
    $sigService = app(SignatureService::class);
    $sigService->sign($request, $pi, '127.0.0.1');
    $sigService->sign($request, $coI, '127.0.0.2');

    // Submit
    app(BudgetRequestService::class)->submit($request->fresh(), $pi);

    // Approve manually
    $request->fresh()->update(['status' => 'approved']);

    // Disburse fully
    app(DisbursementService::class)->disburse($request->fresh(), 50000.00, ['transaction_id' => 'TXN-S1'], $finance);

    return [$request->fresh(), $pi, $finance];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('PI can submit settlement for disbursed request', function () {
    $base = sett_makeBase();
    [$request, $pi] = sett_makeDisbursedRequest($base);

    $settlement = app(BudgetSettlementService::class)->submitSettlement(
        $request, $pi,
        ['total_spent' => 48000, 'unspent_amount' => 2000, 'expense_report_path' => 'reports/r1.pdf']
    );

    expect($settlement)->toBeInstanceOf(BudgetSettlement::class)
        ->and($settlement->status)->toBe('submitted')
        ->and((float) $settlement->total_spent)->toBe(48000.0);
});

test('college officer can verify settlement', function () {
    $base = sett_makeBase();
    [$proposal, $pi, $coI, $collegeAdmin] = $base;
    [$request] = sett_makeDisbursedRequest($base);

    $settlement = app(BudgetSettlementService::class)->submitSettlement(
        $request, $pi, ['total_spent' => 50000, 'unspent_amount' => 0]
    );

    $verified = app(BudgetSettlementService::class)
        ->verifySettlement($settlement, $collegeAdmin, 'Looks good');

    expect($verified->status)->toBe('college_verified')
        ->and($verified->college_verified_by)->toBe($collegeAdmin->id)
        ->and($verified->college_notes)->toBe('Looks good');
});

test('finance can finalize college_verified settlement', function () {
    $base = sett_makeBase();
    [$proposal, $pi, $coI, $collegeAdmin, $finance] = $base;
    [$request] = sett_makeDisbursedRequest($base);

    $settlementService = app(BudgetSettlementService::class);
    $settlement = $settlementService->submitSettlement($request, $pi, ['total_spent' => 50000, 'unspent_amount' => 0]);
    $verified   = $settlementService->verifySettlement($settlement, $collegeAdmin, 'Verified');

    $finalized = $settlementService->finalizeSettlement($verified, $finance, 'Finalized');

    expect($finalized->status)->toBe('finance_verified')
        ->and($finalized->finance_verified_by)->toBe($finance->id);
});

test('cannot finalize without college verification first', function () {
    $base = sett_makeBase();
    [$proposal, $pi, $coI, $collegeAdmin, $finance] = $base;
    [$request] = sett_makeDisbursedRequest($base);

    $settlement = app(BudgetSettlementService::class)
        ->submitSettlement($request, $pi, ['total_spent' => 50000, 'unspent_amount' => 0]);

    expect(fn () => app(BudgetSettlementService::class)->finalizeSettlement($settlement, $finance, 'Skip'))
        ->toThrow(\Exception::class, 'college-verified');
});

test('after finalization status = finance_verified', function () {
    $base = sett_makeBase();
    [$proposal, $pi, $coI, $collegeAdmin, $finance] = $base;
    [$request] = sett_makeDisbursedRequest($base);

    $svc        = app(BudgetSettlementService::class);
    $settlement = $svc->submitSettlement($request, $pi, ['total_spent' => 50000, 'unspent_amount' => 0]);
    $verified   = $svc->verifySettlement($settlement, $collegeAdmin, 'OK');
    $finalized  = $svc->finalizeSettlement($verified, $finance, 'Done');

    expect($finalized->fresh()->status)->toBe('finance_verified');
});

test('after finalization budget_request status = settled', function () {
    $base = sett_makeBase();
    [$proposal, $pi, $coI, $collegeAdmin, $finance] = $base;
    [$request] = sett_makeDisbursedRequest($base);

    $svc        = app(BudgetSettlementService::class);
    $settlement = $svc->submitSettlement($request, $pi, ['total_spent' => 50000, 'unspent_amount' => 0]);
    $verified   = $svc->verifySettlement($settlement, $collegeAdmin, 'OK');
    $svc->finalizeSettlement($verified, $finance, 'Done');

    expect($request->fresh()->status)->toBe('settled');
});

test('full round lifecycle: create→sign→submit→approve→disburse→settle→college verify→finance finalize→eligible for Round 2', function () {
    $base = sett_makeBase();
    [$proposal, $pi, $coI, $collegeAdmin, $finance] = $base;

    $template = FormTemplate::where('name', 'Research Budget Request')->first();
    $items    = [['category' => 'Personnel', 'description' => 'RA', 'amount' => 50000, 'justification' => null]];
    $brqSvc   = app(BudgetRequestService::class);
    $sigSvc   = app(SignatureService::class);
    $disbSvc  = app(DisbursementService::class);
    $svc      = app(BudgetSettlementService::class);

    // Round 1
    $r1 = $brqSvc->create($proposal, $template->id, $items, $pi);
    expect($r1->funding_round)->toBe(1);

    $sigSvc->sign($r1, $pi, '127.0.0.1');
    $sigSvc->sign($r1, $coI, '127.0.0.2');
    $r1 = $brqSvc->submit($r1->fresh(), $pi)->fresh();
    expect($r1->status)->toBe('submitted');

    $r1->update(['status' => 'approved']);
    $disbSvc->disburse($r1->fresh(), 50000.00, [], $finance);
    $r1 = $r1->fresh();
    expect($r1->status)->toBe('disbursed');

    $settlement = $svc->submitSettlement($r1, $pi, ['total_spent' => 50000, 'unspent_amount' => 0]);
    $verified   = $svc->verifySettlement($settlement, $collegeAdmin, 'Good');
    $svc->finalizeSettlement($verified, $finance, 'Complete');
    $r1 = $r1->fresh();
    expect($r1->status)->toBe('settled');

    // Round 2 — now eligible
    $r2 = $brqSvc->create($proposal->fresh(), $template->id, $items, $pi);
    expect($r2->funding_round)->toBe(2);
});
