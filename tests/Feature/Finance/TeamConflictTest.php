<?php

use App\Exceptions\CannotWithdrawPIException;
use App\Exceptions\MemberAlreadyInactiveException;
use App\Models\BudgetAllocation;
use App\Models\College;
use App\Models\Department;
use App\Models\FormSignature;
use App\Models\FormTemplate;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\BudgetRequestService;
use App\Services\TeamConflictService;
use Database\Seeders\FormTemplateSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new FormTemplateSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function conflict_makeProposalWithMembers(): array
{
    $college = College::create(['name' => 'Conflict College '.rand(), 'code' => 'CC'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CF'.rand(10, 99)]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $coI = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $coI->assignRole('pi');
    $coI2 = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $coI2->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'conflict-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Conflict Proposal', 'status' => 'funded',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
        'contract_status' => 'approved', 'contract_signed_at' => now(),
        'contract_signed_by' => $pi->id,
    ]);

    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $pi->id,
        'role' => 'pi', 'status' => 'active', 'contribution_percentage' => 34, 'joined_at' => now(),
    ]);
    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $coI->id,
        'role' => 'co_investigator', 'status' => 'active', 'contribution_percentage' => 33, 'joined_at' => now(),
    ]);
    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $coI2->id,
        'role' => 'co_investigator', 'status' => 'active', 'contribution_percentage' => 33, 'joined_at' => now(),
    ]);

    // Budget requests need an approved allocation (BudgetRequestService).
    BudgetAllocation::create([
        'college_id' => $college->id, 'proposal_id' => $proposal->id, 'fiscal_year' => '2026',
        'total_amount' => 200000.00, 'allocated_amount' => 0, 'remaining_balance' => 200000.00,
        'allocation_type' => 'proposal', 'status' => 'approved',
        'approved_by' => $central->id, 'approved_at' => now(), 'allocated_by' => $central->id,
    ]);

    return [$proposal, $pi, $coI, $coI2, $central];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('can withdraw co-investigator with reason', function () {
    [$proposal, $pi, $coI, $coI2, $central] = conflict_makeProposalWithMembers();

    $member = app(TeamConflictService::class)
        ->withdrawMember($proposal, $coI, 'Left institution', $central);

    expect($member->status)->toBe('withdrawn');
});

test('withdrawn member status = withdrawn never deleted', function () {
    [$proposal, $pi, $coI] = conflict_makeProposalWithMembers();

    app(TeamConflictService::class)->withdrawMember($proposal, $coI, 'Left', $pi);

    expect(ProposalMember::where('user_id', $coI->id)->where('proposal_id', $proposal->id)->exists())
        ->toBeTrue();
});

test('withdrawal reason stored on record', function () {
    [$proposal, $pi, $coI] = conflict_makeProposalWithMembers();

    app(TeamConflictService::class)->withdrawMember($proposal, $coI, 'Personal reasons', $pi);

    $record = ProposalMember::where('user_id', $coI->id)->where('proposal_id', $proposal->id)->first();

    expect($record->withdrawal_reason)->toBe('Personal reasons')
        ->and($record->withdrawn_at)->not->toBeNull();
});

test('pending signatures invalidated on withdrawal', function () {
    [$proposal, $pi, $coI] = conflict_makeProposalWithMembers();

    $template = FormTemplate::first();
    $items = [['category' => 'P', 'description' => 'RA', 'amount' => 10000, 'justification' => null]];
    $request = app(BudgetRequestService::class)->create($proposal, $template->id, $items, $pi);

    $pendingBefore = FormSignature::where('user_id', $coI->id)
        ->where('status', 'pending')
        ->count();
    expect($pendingBefore)->toBe(1);

    app(TeamConflictService::class)->withdrawMember($proposal, $coI, 'Withdrew', $pi);

    $pendingAfter = FormSignature::where('user_id', $coI->id)
        ->where('status', 'pending')
        ->count();
    expect($pendingAfter)->toBe(0);

    $refusedSig = FormSignature::where('user_id', $coI->id)
        ->where('budget_request_id', $request->id)
        ->first();
    expect($refusedSig->status)->toBe('refused')
        ->and($refusedSig->refusal_reason)->toBe('Member withdrawn from proposal');
});

test('contribution percentages recalculate for remaining active members', function () {
    [$proposal, $pi, $coI, $coI2] = conflict_makeProposalWithMembers();

    // 3 members before withdrawal → 2 active after
    app(TeamConflictService::class)->withdrawMember($proposal, $coI, 'Left', $pi);

    $activeMembers = ProposalMember::where('proposal_id', $proposal->id)
        ->where('status', 'active')
        ->get();

    expect($activeMembers)->toHaveCount(2);

    $totalPercentage = $activeMembers->sum('contribution_percentage');
    expect((float) $totalPercentage)->toEqual(100.0);

    foreach ($activeMembers as $m) {
        expect((float) $m->contribution_percentage)->toBe(50.0);
    }
});

test('cannot withdraw PI', function () {
    [$proposal, $pi, $coI] = conflict_makeProposalWithMembers();

    expect(fn () => app(TeamConflictService::class)->withdrawMember($proposal, $pi, 'Try PI', $pi))
        ->toThrow(CannotWithdrawPIException::class);
});

test('cannot withdraw already inactive member', function () {
    [$proposal, $pi, $coI] = conflict_makeProposalWithMembers();
    $service = app(TeamConflictService::class);

    $service->withdrawMember($proposal, $coI, 'First time', $pi);

    expect(fn () => $service->withdrawMember($proposal->fresh(), $coI, 'Again', $pi))
        ->toThrow(MemberAlreadyInactiveException::class);
});

test('withdrawal written to audit_logs', function () {
    [$proposal, $pi, $coI] = conflict_makeProposalWithMembers();

    $memberRecord = ProposalMember::where('proposal_id', $proposal->id)
        ->where('user_id', $coI->id)
        ->first();

    app(TeamConflictService::class)->withdrawMember($proposal, $coI, 'Audit this', $pi);

    $log = DB::table('audit_logs')
        ->where('auditable_type', ProposalMember::class)
        ->where('auditable_id', $memberRecord->id)
        ->where('event', 'member.withdrawn')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->actor_id)->toBe($pi->id);
});
