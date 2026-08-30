<?php

use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    Storage::fake('private');
});

function csa_makeFundedProposal(): array
{
    $college = College::create(['name' => 'CSA College '.rand(), 'code' => 'CSA'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CSAD'.rand(10, 99)]);

    $officer = User::factory()->create();
    $officer->assignRole('research_officer');

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'csa-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $officer->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'CSA-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Contract Audit Test Proposal', 'status' => 'funded',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    Award::create([
        'proposal_id' => $proposal->id,
        'awarded_amount' => 100000.00,
        'approved_by' => $officer->id,
        'approved_at' => now(),
        'grant_reference' => 'GR-CSA-'.rand(1000, 9999),
    ]);

    BudgetAllocation::create([
        'college_id' => $college->id,
        'proposal_id' => $proposal->id,
        'fiscal_year' => '2026',
        'total_amount' => 100000.00,
        'allocated_amount' => 0,
        'remaining_balance' => 100000.00,
        'allocation_type' => 'proposal',
        'status' => 'approved',
        'approved_by' => $officer->id,
        'approved_at' => now(),
        'allocated_by' => $officer->id,
    ]);

    return [$proposal, $pi, $officer];
}

test('submitting a contract records the submitter\'s IP address', function () {
    [$proposal, $pi] = csa_makeFundedProposal();
    $token = $pi->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/submit", [
            'file' => UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf'),
        ])
        ->assertOk();

    expect($proposal->fresh()->contract_submitted_ip)->not->toBeNull();
});

test('approving a contract records the approver\'s IP address alongside signed_at/signed_by', function () {
    [$proposal, $pi, $officer] = csa_makeFundedProposal();
    $proposal->update(['contract_status' => 'pending', 'contract_submitted_at' => now()]);
    $token = $officer->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/approve")
        ->assertOk();

    $fresh = $proposal->fresh();
    expect($fresh->contract_signed_ip)->not->toBeNull()
        ->and($fresh->contract_signed_at)->not->toBeNull()
        ->and($fresh->contract_signed_by)->toBe($officer->id);
});

test('rejecting a contract records who rejected it, when, and from where', function () {
    [$proposal, $pi, $officer] = csa_makeFundedProposal();
    $proposal->update(['contract_status' => 'pending']);
    $token = $officer->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/reject", [
            'reason' => 'Missing signature page.',
        ])
        ->assertOk();

    $fresh = $proposal->fresh();
    expect($fresh->contract_rejected_at)->not->toBeNull()
        ->and($fresh->contract_rejected_by)->toBe($officer->id)
        ->and($fresh->contract_rejected_ip)->not->toBeNull();
});

test('resubmitting after rejection clears the prior rejection audit trail', function () {
    [$proposal, $pi, $officer] = csa_makeFundedProposal();
    $proposal->update([
        'contract_status' => 'rejected',
        'contract_rejection_reason' => 'Bad scan.',
        'contract_rejected_at' => now(),
        'contract_rejected_by' => $officer->id,
        'contract_rejected_ip' => '10.0.0.1',
    ]);
    $token = $pi->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/submit", [
            'file' => UploadedFile::fake()->create('contract-v2.pdf', 100, 'application/pdf'),
        ])
        ->assertOk();

    $fresh = $proposal->fresh();
    expect($fresh->contract_status)->toBe('pending')
        ->and($fresh->contract_rejection_reason)->toBeNull()
        ->and($fresh->contract_rejected_at)->toBeNull()
        ->and($fresh->contract_rejected_by)->toBeNull()
        ->and($fresh->contract_rejected_ip)->toBeNull();
});

test('removing a contract clears all submission and rejection audit fields', function () {
    [$proposal, $pi, $officer] = csa_makeFundedProposal();
    $proposal->update([
        'contract_status' => 'rejected',
        'contract_document_path' => 'contracts/fake.pdf',
        'contract_submitted_at' => now(),
        'contract_submitted_by' => $pi->id,
        'contract_submitted_ip' => '10.0.0.5',
        'contract_rejection_reason' => 'Bad scan.',
        'contract_rejected_at' => now(),
        'contract_rejected_by' => $officer->id,
        'contract_rejected_ip' => '10.0.0.1',
    ]);
    Storage::disk('private')->put('contracts/fake.pdf', 'fake-content');
    $token = $pi->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->deleteJson("/api/v1/proposals/{$proposal->id}/contract")
        ->assertOk();

    $fresh = $proposal->fresh();
    expect($fresh->contract_submitted_ip)->toBeNull()
        ->and($fresh->contract_rejected_at)->toBeNull()
        ->and($fresh->contract_rejected_by)->toBeNull()
        ->and($fresh->contract_rejected_ip)->toBeNull();
});
