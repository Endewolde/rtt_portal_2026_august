<?php

use App\Models\College;
use App\Models\Department;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\ProposalService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedRequiredData(\App\Models\Proposal $proposal, User $pi): void
{
    \App\Models\ProposalBudget::create([
        'proposal_id'      => $proposal->id,
        'category'         => 'personnel',
        'item_description' => 'Research assistant salary',
        'amount'           => 5000,
        'justification'    => null,
    ]);

    \App\Models\ProposalDocument::create([
        'proposal_id'       => $proposal->id,
        'document_type'     => 'proposal_document',
        'original_filename' => 'proposal.pdf',
        'stored_path'       => 'test/proposal.pdf',
        'file_size'         => 102400,
        'mime_type'         => 'application/pdf',
        'uploaded_by'       => $pi->id,
    ]);

    // Satisfy the co-investigator requirement added to ProposalService::submit()
    $coUser = User::factory()->create();
    $coUser->assignRole('pi');
    ProposalMember::create([
        'proposal_id'             => $proposal->id,
        'user_id'                 => $coUser->id,
        'role'                    => 'co_investigator',
        'contribution_percentage' => 20,
        'status'                  => 'active',
        'joined_at'               => now(),
    ]);
}

function makePI(): User
{
    $college = College::create(['name' => 'Test College', 'code' => 'TC-'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'Test Dept', 'code' => 'TD-'.rand(10, 99)]);
    $pi      = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return $pi;
}

function makeActiveCall(User $createdBy): ProposalCall
{
    return ProposalCall::create([
        'academic_year' => '2026',
        'category'      => 'research',
        'title'         => 'Test Call '.rand(1, 9999),
        'slug'          => 'test-call-'.rand(10000, 99999),
        'start_date'    => now()->toDateString(),
        'end_date'      => now()->addMonths(3)->toDateString(),
        'status'        => 'active',
        'is_open'       => true,
        'created_by'    => $createdBy->id,
    ]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('draft created when user has college but no department auto-assigns first department', function () {
    $college = College::create(['name' => 'No-Dept College', 'code' => 'NDC-'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'Auto Dept', 'code' => 'AD-'.rand(10, 99)]);
    $pi      = User::factory()->create(['college_id' => $college->id, 'department_id' => null]);
    $pi->assignRole('pi');
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);

    expect($proposal->department_id)->toBe($dept->id);
});

test('draft created with status=draft and correct tracker prefix DRAFT-', function () {
    $pi      = makePI();
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);

    expect($proposal->status)->toBe('draft')
        ->and($proposal->tracker_number)->toStartWith('DRAFT-');
});

test('step 1 saves title abstract and keywords to draft_data', function () {
    $pi      = makePI();
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);
    $proposal = $service->saveStep($proposal, 1, [
        'title'    => 'My Research Proposal',
        'abstract' => 'This is the abstract.',
        'keywords' => 'AI, health',
    ], $pi);

    expect($proposal->title)->toBe('My Research Proposal')
        ->and($proposal->abstract)->toBe('This is the abstract.')
        ->and($proposal->draft_data['step_1']['title'])->toBe('My Research Proposal');
});

test('step 3 creates proposal_members for co-investigators', function () {
    $pi      = makePI();
    $co      = User::factory()->create();
    $co->assignRole('pi');
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);

    // Complete step 1 first
    $service->saveStep($proposal->fresh(), 1, ['title' => 'Title', 'abstract' => 'Abs'], $pi);
    // Complete step 2
    $service->saveStep($proposal->fresh(), 2, ['field' => 'value'], $pi);
    // Save step 3
    $service->saveStep($proposal->fresh(), 3, [
        'co_investigators' => [
            ['user_id' => $co->id, 'contribution_percentage' => 30],
        ],
    ], $pi);

    $coMember = ProposalMember::where('proposal_id', $proposal->id)
        ->where('user_id', $co->id)
        ->where('role', 'co_investigator')
        ->first();

    expect($coMember)->not->toBeNull()
        ->and((float) $coMember->contribution_percentage)->toBe(30.0);
});

test('cannot jump to step 4 without completing step 1 first', function () {
    $pi      = makePI();
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);

    // current_wizard_step is 1, jumping to step 4 is more than 1 ahead
    expect(fn () => $service->saveStep($proposal, 4, ['items' => []], $pi))
        ->toThrow(\App\Exceptions\InvalidWizardStepException::class);
});

test('cannot submit without budget items', function () {
    $pi      = makePI();
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);

    // Save step 1 only — no budget items or documents in DB
    $service->saveStep($proposal->fresh(), 1, ['title' => 'Title', 'abstract' => 'Abstract text'], $pi);

    expect(fn () => $service->submit($proposal->fresh(), $pi))
        ->toThrow(\App\Exceptions\IncompleteProposalException::class, 'budget item');
});

test('submit generates real tracker number in correct format RES-2026-000001', function () {
    $pi      = makePI();
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);

    $service->saveStep($proposal->fresh(), 1, ['title' => 'Research Title', 'abstract' => 'Abstract text here'], $pi);
    $service->saveStep($proposal->fresh(), 2, ['field' => 'val'], $pi);
    $service->saveStep($proposal->fresh(), 3, ['co_investigators' => []], $pi);
    $service->saveStep($proposal->fresh(), 4, ['items' => []], $pi);
    $service->saveStep($proposal->fresh(), 5, ['files' => []], $pi);
    seedRequiredData($proposal, $pi);

    $submitted = $service->submit($proposal->fresh(), $pi);

    expect($submitted->tracker_number)->toMatch('/^RES-2026-\d{6}$/');
});

test('submit transitions proposal status to submitted', function () {
    $pi      = makePI();
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);

    $service->saveStep($proposal->fresh(), 1, ['title' => 'Title', 'abstract' => 'Abstract text here'], $pi);
    $service->saveStep($proposal->fresh(), 2, ['field' => 'val'], $pi);
    $service->saveStep($proposal->fresh(), 3, ['co_investigators' => []], $pi);
    $service->saveStep($proposal->fresh(), 4, ['items' => []], $pi);
    $service->saveStep($proposal->fresh(), 5, ['files' => []], $pi);
    seedRequiredData($proposal, $pi);

    $submitted = $service->submit($proposal->fresh(), $pi);

    expect($submitted->status)->toBe('submitted');
});

test('submitted proposal has submitted_at timestamp', function () {
    $pi      = makePI();
    $service = app(ProposalService::class);
    $call    = makeActiveCall($pi);

    $proposal = $service->createDraft($pi, $call->id);

    $service->saveStep($proposal->fresh(), 1, ['title' => 'Title', 'abstract' => 'Abstract text here'], $pi);
    $service->saveStep($proposal->fresh(), 2, ['field' => 'val'], $pi);
    $service->saveStep($proposal->fresh(), 3, ['co_investigators' => []], $pi);
    $service->saveStep($proposal->fresh(), 4, ['items' => []], $pi);
    $service->saveStep($proposal->fresh(), 5, ['files' => []], $pi);
    seedRequiredData($proposal, $pi);

    $submitted = $service->submit($proposal->fresh(), $pi);

    expect($submitted->submitted_at)->not->toBeNull();
});
