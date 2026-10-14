<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Models\ProposalMember;
use App\Models\ProposalVersion;
use App\Models\User;
use App\Services\ProposalService;
use App\Services\WorkflowService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $this->pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $this->pi->assignRole('staff');
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'pv-'.rand(10000, 99999),
        'start_date' => now()->subDay()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->proposal = Proposal::create([
        'tracker_number' => 'DRAFT-'.rand(10000, 99999), 'proposal_call_id' => $call->id, 'pi_user_id' => $this->pi->id,
        'college_id' => $college->id, 'department_id' => $dept->id, 'title' => 'Soil Health', 'abstract' => 'First abstract.',
        'status' => 'draft', 'category' => 'research', 'academic_year' => '2026', 'created_by' => $this->pi->id,
    ]);
    $coInvestigator = User::factory()->create();
    ProposalMember::create(['proposal_id' => $this->proposal->id, 'user_id' => $coInvestigator->id, 'role' => 'co_investigator', 'status' => 'active', 'invitation_status' => 'accepted', 'joined_at' => now()]);
    ProposalBudget::create(['proposal_id' => $this->proposal->id, 'category' => 'equipment', 'item_description' => 'Soil kit', 'amount' => 1000]);
    ProposalDocument::create(['proposal_id' => $this->proposal->id, 'document_type' => 'proposal', 'version' => 1, 'is_current' => true,
        'original_filename' => 'proposal.pdf', 'stored_path' => 'x/proposal.pdf', 'file_size' => 100, 'mime_type' => 'application/pdf', 'uploaded_by' => $this->pi->id]);
});

test('resubmitting keeps the tracker number and records what changed', function () {
    $service = app(ProposalService::class);
    $first = $service->submit($this->proposal, $this->pi);
    $tracker = $first->tracker_number;
    expect($tracker)->not->toStartWith('DRAFT-');

    app(WorkflowService::class)->transition($first->fresh(), 'return_for_correction', $this->central, 'Fix the budget');
    $this->proposal->refresh()->update(['abstract' => 'Corrected abstract.']);
    ProposalBudget::where('proposal_id', $this->proposal->id)->update(['amount' => 800]);

    $second = $service->submit($this->proposal->fresh(), $this->pi);

    expect($second->tracker_number)->toBe($tracker)
        ->and(ProposalVersion::where('proposal_id', $this->proposal->id)->count())->toBe(2);

    $latest = $this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/versions")
        ->assertOk()->json('data.0');

    expect($latest['version_number'])->toBe(2)
        ->and(collect($latest['changes']['fields'])->pluck('field')->all())->toBe(['abstract'])
        ->and($latest['changes']['budget']['changed'][0]['before'])->toEqual(1000)
        ->and($latest['changes']['budget']['total_after'])->toEqual(800);
});

test('people outside the proposal cannot see its versions', function () {
    app(ProposalService::class)->submit($this->proposal, $this->pi);
    $stranger = User::factory()->create();
    $stranger->assignRole('staff');

    $this->actingAs($stranger, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/versions")->assertForbidden();
});
