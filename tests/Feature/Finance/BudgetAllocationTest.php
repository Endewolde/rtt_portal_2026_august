<?php

use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\BudgetAllocationService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function alloc_makeBase(): array
{
    $college = College::create(['name' => 'Alloc College '.rand(), 'code' => 'AC'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'AD'.rand(10, 99)]);

    $central = User::factory()->create();
    $central->assignRole('central_office');

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'alloc-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'Test Proposal', 'status' => 'funded',
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    // Create an award so the college has a budget pool to draw from
    Award::create([
        'proposal_id'     => $proposal->id,
        'awarded_amount'  => 500000.00,
        'approved_by'     => $central->id,
        'approved_at'     => now(),
        'grant_reference' => 'GR-'.rand(1000, 9999),
    ]);

    return [$college, $proposal, $central, $pi];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('central office can allocate budget to college', function () {
    [$college, $proposal, $central] = alloc_makeBase();

    $allocation = app(BudgetAllocationService::class)
        ->allocateToCollege($college, 500000.00, '2025/2026', $central);

    expect($allocation)->toBeInstanceOf(BudgetAllocation::class)
        ->and($allocation->college_id)->toBe($college->id)
        ->and((float) $allocation->total_amount)->toBe(500000.0)
        ->and((float) $allocation->remaining_balance)->toBe(500000.0)
        ->and((float) $allocation->allocated_amount)->toBe(0.0)
        ->and($allocation->allocation_type)->toBe('college');
});

test('can allocate from college envelope to proposal', function () {
    [$college, $proposal, $central] = alloc_makeBase();
    $service = app(BudgetAllocationService::class);

    $proposalAllocation = $service->allocateToProposal($proposal, 150000.00, '2025/2026', $central);

    expect($proposalAllocation)->toBeInstanceOf(BudgetAllocation::class)
        ->and($proposalAllocation->proposal_id)->toBe($proposal->id)
        ->and((float) $proposalAllocation->total_amount)->toBe(150000.0)
        ->and($proposalAllocation->allocation_type)->toBe('proposal');
});

test('cannot allocate more than awarded college budget', function () {
    [$college, $proposal, $central] = alloc_makeBase();
    $service = app(BudgetAllocationService::class);

    // Award is 500,000 — attempting 600,000 must fail
    expect(fn () => $service->allocateToProposal($proposal, 600000.00, '2025/2026', $central))
        ->toThrow(\Exception::class, 'exceeds college remaining balance');
});

test('remaining balance computed correctly after proposal allocation', function () {
    [$college, $proposal, $central] = alloc_makeBase();
    $service = app(BudgetAllocationService::class);

    $service->allocateToProposal($proposal, 150000.00, '2025/2026', $central);

    // Award is 500,000; 150,000 allocated → remaining is 350,000
    $totalAllocated = BudgetAllocation::where('college_id', $college->id)
        ->where('allocation_type', 'proposal')
        ->sum('total_amount');

    $awardTotal = Award::whereHas(
        'proposal', fn ($q) => $q->where('college_id', $college->id)
    )->sum('awarded_amount');

    expect((float) $totalAllocated)->toBe(150000.0)
        ->and((float) ($awardTotal - $totalAllocated))->toBe(350000.0);
});
