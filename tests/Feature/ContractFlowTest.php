<?php

use App\Models\Award;
use App\Models\BudgetAllocation;
use App\Models\College;
use App\Models\Department;
use App\Models\FormTemplate;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\BudgetRequestService;
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
});

function contract_makeFundedProposal(): array
{
    $college = College::create(['name' => 'CTR College '.rand(), 'code' => 'CT'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CD'.rand(10, 99)]);

    $officer = User::factory()->create();
    $officer->assignRole('research_officer');

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ctr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $officer->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Contract Test Proposal', 'status' => 'funded',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    Award::create([
        'proposal_id' => $proposal->id,
        'awarded_amount' => 100000.00,
        'approved_by' => $officer->id,
        'approved_at' => now(),
        'grant_reference' => 'GR-CTR-'.rand(1000, 9999),
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

// ─── PI submit ────────────────────────────────────────────────────────────────

test('PI can submit signed contract PDF', function () {
    [$proposal, $pi] = contract_makeFundedProposal();

    $token = $pi->createToken('test')->plainTextToken;
    $file = UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf');

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/submit", ['file' => $file])
        ->assertOk();

    expect($proposal->fresh()->contract_status)->toBe('pending');
    Storage::disk('private')->assertExists("contracts/{$proposal->id}");
});

test('non-PI cannot submit contract', function () {
    [$proposal, $pi, $officer] = contract_makeFundedProposal();

    $token = $officer->createToken('test')->plainTextToken;
    $file = UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf');

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/submit", ['file' => $file])
        ->assertForbidden();
});

test('PI cannot resubmit when already approved', function () {
    [$proposal, $pi] = contract_makeFundedProposal();
    $proposal->update(['contract_status' => 'approved', 'contract_signed_at' => now()]);

    $token = $pi->createToken('test')->plainTextToken;
    $file = UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf');

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/submit", ['file' => $file])
        ->assertUnprocessable();
});

// ─── Officer approve ──────────────────────────────────────────────────────────

test('officer can approve pending contract', function () {
    [$proposal, $pi, $officer] = contract_makeFundedProposal();
    $proposal->update(['contract_status' => 'pending', 'contract_submitted_at' => now()]);

    $token = $officer->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/approve")
        ->assertOk();

    $fresh = $proposal->fresh();
    expect($fresh->contract_status)->toBe('approved')
        ->and($fresh->contract_signed_at)->not->toBeNull()
        ->and($fresh->contract_signed_by)->toBe($officer->id);
});

test('officer cannot approve when no pending submission', function () {
    [$proposal, $pi, $officer] = contract_makeFundedProposal();

    $token = $officer->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/approve")
        ->assertUnprocessable();
});

test('PI cannot approve contract', function () {
    [$proposal, $pi] = contract_makeFundedProposal();
    $proposal->update(['contract_status' => 'pending']);

    $token = $pi->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/approve")
        ->assertForbidden();
});

// ─── Officer reject ───────────────────────────────────────────────────────────

test('officer can reject pending contract with reason', function () {
    [$proposal, $pi, $officer] = contract_makeFundedProposal();
    $proposal->update(['contract_status' => 'pending']);

    $token = $officer->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/reject", [
            'reason' => 'Signature is missing on page 3.',
        ])
        ->assertOk();

    $fresh = $proposal->fresh();
    expect($fresh->contract_status)->toBe('rejected')
        ->and($fresh->contract_rejection_reason)->toBe('Signature is missing on page 3.');
});

test('reject requires a reason', function () {
    [$proposal, $pi, $officer] = contract_makeFundedProposal();
    $proposal->update(['contract_status' => 'pending']);

    $token = $officer->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/reject", ['reason' => ''])
        ->assertUnprocessable();
});

// ─── Budget request gate ──────────────────────────────────────────────────────

test('budget request is blocked when contract is pending', function () {
    [$proposal, $pi] = contract_makeFundedProposal();
    $proposal->update(['contract_status' => 'pending']);

    expect(fn () => app(BudgetRequestService::class)
        ->create($proposal->fresh(), FormTemplate::first()->id, [], $pi)
    )->toThrow(Exception::class, 'under review');
});

test('budget request is blocked when contract is rejected', function () {
    [$proposal, $pi] = contract_makeFundedProposal();
    $proposal->update(['contract_status' => 'rejected']);

    expect(fn () => app(BudgetRequestService::class)
        ->create($proposal->fresh(), FormTemplate::first()->id, [], $pi)
    )->toThrow(Exception::class, 'resubmit');
});

test('budget request is blocked when no contract submitted', function () {
    [$proposal, $pi] = contract_makeFundedProposal();

    expect(fn () => app(BudgetRequestService::class)
        ->create($proposal->fresh(), FormTemplate::first()->id, [], $pi)
    )->toThrow(Exception::class, 'upload');
});

// ─── Resubmit clears rejection state ─────────────────────────────────────────

test('resubmitting after rejection clears rejection reason and sets status to pending', function () {
    [$proposal, $pi] = contract_makeFundedProposal();
    $proposal->update(['contract_status' => 'rejected', 'contract_rejection_reason' => 'Wrong document.']);

    $token = $pi->createToken('pi')->plainTextToken;
    $file = UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf');

    $this->withToken($token)
        ->postJson("/api/v1/proposals/{$proposal->id}/contract/submit", ['file' => $file])
        ->assertOk();

    $fresh = $proposal->fresh();
    expect($fresh->contract_status)->toBe('pending')
        ->and($fresh->contract_rejection_reason)->toBeNull();
});

// ─── Download ─────────────────────────────────────────────────────────────────

test('the owning PI can download their own contract', function () {
    [$proposal, $pi] = contract_makeFundedProposal();
    Storage::disk('private')->put("contracts/{$proposal->id}/x.pdf", 'pdf-bytes');
    $proposal->update(['contract_document_path' => "contracts/{$proposal->id}/x.pdf"]);

    $token = $pi->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->get("/api/v1/proposals/{$proposal->id}/contract/download")
        ->assertOk();
});

test('an officer can download any proposal\'s contract', function () {
    [$proposal, $pi, $officer] = contract_makeFundedProposal();
    Storage::disk('private')->put("contracts/{$proposal->id}/x.pdf", 'pdf-bytes');
    $proposal->update(['contract_document_path' => "contracts/{$proposal->id}/x.pdf"]);

    $token = $officer->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->get("/api/v1/proposals/{$proposal->id}/contract/download")
        ->assertOk();
});

test('an unrelated authenticated user cannot download someone else\'s contract', function () {
    [$proposal, $pi] = contract_makeFundedProposal();
    Storage::disk('private')->put("contracts/{$proposal->id}/x.pdf", 'pdf-bytes');
    $proposal->update(['contract_document_path' => "contracts/{$proposal->id}/x.pdf"]);

    $stranger = User::factory()->create();
    $stranger->assignRole('pi');
    $token = $stranger->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->get("/api/v1/proposals/{$proposal->id}/contract/download")
        ->assertForbidden();
});
