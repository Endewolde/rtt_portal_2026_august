<?php

use App\Exceptions\PreviousSettlementPendingException;
use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Models\College;
use App\Models\Department;
use App\Models\FormSignature;
use App\Models\FormTemplate;
use App\Models\MidtermEvaluation;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\BudgetRequestService;
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

function brq_makeFundedProposal(): array
{
    $college = College::create(['name' => 'BRQ College '.rand(), 'code' => 'BR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'BD'.rand(10000, 99999)]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $coI = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $coI->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'brq-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Funded Proposal', 'status' => 'funded',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
        'contract_status' => 'approved', 'contract_signed_at' => now(),
        'contract_signed_by' => $central->id,
    ]);

    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $pi->id,
        'role' => 'pi', 'status' => 'active',
        'contribution_percentage' => 50, 'joined_at' => now(),
    ]);
    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $coI->id,
        'role' => 'co_investigator', 'status' => 'active',
        'contribution_percentage' => 50, 'joined_at' => now(),
    ]);

    // Award the proposal and create an approved allocation so budget requests can be made
    Award::create([
        'proposal_id' => $proposal->id,
        'awarded_amount' => 200000.00,
        'approved_by' => $central->id,
        'approved_at' => now(),
        'grant_reference' => 'GR-BRQ-'.rand(1000, 9999),
    ]);

    BudgetAllocation::create([
        'college_id' => $college->id,
        'proposal_id' => $proposal->id,
        'fiscal_year' => '2026',
        'total_amount' => 200000.00,
        'allocated_amount' => 0,
        'remaining_balance' => 200000.00,
        'allocation_type' => 'proposal',
        'status' => 'approved',
        'approved_by' => $central->id,
        'approved_at' => now(),
        'allocated_by' => $central->id,
    ]);

    $template = FormTemplate::where('name', 'Research Budget Request')->first();

    return [$proposal, $pi, $coI, $template, $central];
}

function brq_defaultItems(): array
{
    return [
        ['category' => 'Personnel', 'description' => 'RA Salary', 'amount' => 30000, 'justification' => 'Research support'],
        ['category' => 'Equipment', 'description' => 'Laptop', 'amount' => 20000, 'justification' => 'Data analysis'],
    ];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('PI can create budget request for funded proposal', function () {
    [$proposal, $pi] = brq_makeFundedProposal();

    $request = app(BudgetRequestService::class)
        ->create($proposal, FormTemplate::first()->id, brq_defaultItems(), $pi);

    expect($request)->toBeInstanceOf(BudgetRequest::class)
        ->and($request->proposal_id)->toBe($proposal->id)
        ->and($request->status)->toBe('draft');
});

test('total amount equals sum of line items', function () {
    [$proposal, $pi] = brq_makeFundedProposal();

    $items = brq_defaultItems();
    $request = app(BudgetRequestService::class)
        ->create($proposal, FormTemplate::first()->id, $items, $pi);

    $expectedTotal = collect($items)->sum('amount');
    expect((float) $request->total_amount)->toBe((float) $expectedTotal);
});

test('form_signatures created for all active members on creation', function () {
    [$proposal, $pi, $coI] = brq_makeFundedProposal();

    $request = app(BudgetRequestService::class)
        ->create($proposal, FormTemplate::first()->id, brq_defaultItems(), $pi);

    $signatures = FormSignature::where('budget_request_id', $request->id)->get();

    expect($signatures)->toHaveCount(2)
        ->and($signatures->pluck('user_id')->sort()->values()->toArray())
        ->toBe(collect([$pi->id, $coI->id])->sort()->values()->toArray())
        ->and($signatures->every(fn ($s) => $s->status === 'pending'))->toBeTrue();
});

test('funding_round increments correctly on second request', function () {
    [$proposal, $pi, $coI] = brq_makeFundedProposal();
    $service = app(BudgetRequestService::class);
    $template = FormTemplate::first();

    $round1 = $service->create($proposal, $template->id, brq_defaultItems(), $pi);

    // Mark round 1 as settled
    $round1->update(['status' => 'settled']);
    BudgetSettlement::create([
        'budget_request_id' => $round1->id,
        'submitted_by' => $pi->id,
        'status' => 'finance_verified',
        'total_spent' => 50000,
        'unspent_amount' => 0,
    ]);

    // PI must pass midterm evaluation to unlock Round 2
    MidtermEvaluation::create([
        'proposal_id' => $proposal->id,
        'evaluation_date' => now()->toDateString(),
        'status' => 'scored',
        'scheduled_by' => $pi->id,
        'recommendation' => 'continue',
        'progress_score' => 80,
    ]);

    $round2 = $service->create($proposal, $template->id, brq_defaultItems(), $pi);

    expect($round1->funding_round)->toBe(1)
        ->and($round2->funding_round)->toBe(2);
});

test('cannot create Round 2 if Round 1 settlement is submitted but not finance_verified', function () {
    [$proposal, $pi] = brq_makeFundedProposal();
    $service = app(BudgetRequestService::class);
    $template = FormTemplate::first();

    $round1 = $service->create($proposal, $template->id, brq_defaultItems(), $pi);
    $round1->update(['status' => 'disbursed']);
    BudgetSettlement::create([
        'budget_request_id' => $round1->id,
        'submitted_by' => $pi->id,
        'status' => 'submitted',
        'total_spent' => 50000,
        'unspent_amount' => 0,
    ]);

    expect(fn () => $service->create($proposal, $template->id, brq_defaultItems(), $pi))
        ->toThrow(PreviousSettlementPendingException::class);
});

test('cannot create Round 2 if Round 1 settlement is college_verified but not finance_verified', function () {
    [$proposal, $pi] = brq_makeFundedProposal();
    $service = app(BudgetRequestService::class);
    $template = FormTemplate::first();

    $round1 = $service->create($proposal, $template->id, brq_defaultItems(), $pi);
    $round1->update(['status' => 'disbursed']);
    BudgetSettlement::create([
        'budget_request_id' => $round1->id,
        'submitted_by' => $pi->id,
        'status' => 'college_verified',
        'total_spent' => 50000,
        'unspent_amount' => 0,
    ]);

    expect(fn () => $service->create($proposal, $template->id, brq_defaultItems(), $pi))
        ->toThrow(PreviousSettlementPendingException::class);
});

test('CAN create Round 2 after Round 1 settlement is finance_verified', function () {
    [$proposal, $pi] = brq_makeFundedProposal();
    $service = app(BudgetRequestService::class);
    $template = FormTemplate::first();

    $round1 = $service->create($proposal, $template->id, brq_defaultItems(), $pi);
    $round1->update(['status' => 'settled']);
    BudgetSettlement::create([
        'budget_request_id' => $round1->id,
        'submitted_by' => $pi->id,
        'status' => 'finance_verified',
        'total_spent' => 50000,
        'unspent_amount' => 0,
    ]);

    MidtermEvaluation::create([
        'proposal_id' => $proposal->id,
        'evaluation_date' => now()->toDateString(),
        'status' => 'scored',
        'scheduled_by' => $pi->id,
        'recommendation' => 'continue',
        'progress_score' => 75,
    ]);

    $round2 = $service->create($proposal, $template->id, brq_defaultItems(), $pi);

    expect($round2)->toBeInstanceOf(BudgetRequest::class)
        ->and($round2->funding_round)->toBe(2);
});
