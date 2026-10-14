<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function rdv_makeProposalWithAllDocumentTypes(): array
{
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');

    $college = College::create(['name' => 'RDV College '.rand(), 'code' => 'RV'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RVD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'RDV Call', 'slug' => 'rdv-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);
    $proposal = Proposal::create([
        'tracker_number' => 'RDV-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'RDV Proposal', 'status' => 'under_blind_review',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    foreach (['proposal_document', 'budget_spreadsheet', 'pi_cv', 'supporting_document'] as $type) {
        ProposalDocument::create([
            'proposal_id' => $proposal->id,
            'document_type' => $type,
            'original_filename' => "{$type}.pdf",
            'stored_path' => "proposals/{$proposal->id}/documents/{$type}.pdf",
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'uploaded_by' => $pi->id,
        ]);
    }

    return [$proposal, $pi, $admin];
}

test('a reviewer scoring a proposal only sees the proposal document and budget spreadsheet', function () {
    [$proposal, , $admin] = rdv_makeProposalWithAllDocumentTypes();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = EvaluationType::create([
        'name' => 'blind_review_rdv_'.rand(1000, 9999),
        'label' => 'Blind Review', 'proposal_category' => 'research', 'is_active' => true,
    ]);
    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $admin->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->addDays(7)->toDateString(),
    ]);

    $response = $this->actingAs($reviewer, 'sanctum')
        ->getJson("/api/v1/review-assignments/{$assignment->id}");

    $response->assertOk();
    $types = collect($response->json('data.proposal.documents'))->pluck('document_type')->all();
    expect($types)->toEqualCanonicalizing(['proposal_document', 'budget_spreadsheet']);
});

test('the proposal detail endpoint also hides non-scoring documents from a reviewer role user', function () {
    [$proposal] = rdv_makeProposalWithAllDocumentTypes();
    $reviewer = User::factory()->create();
    $reviewer->assignRole('staff');

    $response = $this->actingAs($reviewer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}");

    $response->assertOk();
    $types = collect($response->json('data.documents'))->pluck('document_type')->all();
    expect($types)->toEqualCanonicalizing(['proposal_document', 'budget_spreadsheet']);
});

test('the PI still sees all of their own uploaded document types', function () {
    [$proposal, $pi] = rdv_makeProposalWithAllDocumentTypes();

    $response = $this->actingAs($pi, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}");

    $response->assertOk();
    $types = collect($response->json('data.documents'))->pluck('document_type')->all();
    expect($types)->toEqualCanonicalizing(['proposal_document', 'budget_spreadsheet', 'pi_cv', 'supporting_document']);
});

test('central_officer still sees the PI CV', function () {
    [$proposal, , $admin] = rdv_makeProposalWithAllDocumentTypes();

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}");

    $response->assertOk();
    $types = collect($response->json('data.documents'))->pluck('document_type')->all();
    expect($types)->toContain('pi_cv');
});

test('non-central officer roles never see the PI CV in the proposal payload', function (string $role) {
    [$proposal] = rdv_makeProposalWithAllDocumentTypes();
    $officer = User::factory()->create(['college_id' => $proposal->college_id]);
    $officer->assignRole($role);

    $response = $this->actingAs($officer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}");

    $response->assertOk();
    $types = collect($response->json('data.documents'))->pluck('document_type')->all();
    expect($types)->not->toContain('pi_cv');
    expect($types)->toContain('supporting_document');
})->with([
    'research_officer',
    'community_officer',
    'technology_officer',
    'college_officer',
    'finance_officer',
    'support_officer',
]);

test('non-central officer roles cannot download the PI CV directly even with a known document id', function (string $role) {
    [$proposal] = rdv_makeProposalWithAllDocumentTypes();
    $officer = User::factory()->create(['college_id' => $proposal->college_id]);
    $officer->assignRole($role);
    $cv = $proposal->documents()->where('document_type', 'pi_cv')->firstOrFail();

    $response = $this->actingAs($officer, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/documents/{$cv->id}/download");

    $response->assertForbidden();
})->with([
    'research_officer',
    'community_officer',
    'technology_officer',
    'college_officer',
    'finance_officer',
    'support_officer',
]);
