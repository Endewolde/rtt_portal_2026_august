<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Storage::fake('private');
});

function dv_proposal(): array
{
    $college = College::create(['name' => 'DV College '.rand(), 'code' => 'DV'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'DVD'.rand(10, 99)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'dv-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);
    $proposal = Proposal::create([
        'tracker_number' => 'DV-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'draft',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$pi, $proposal];
}

test('the first upload of a document type is version 1 and current', function () {
    [$pi, $proposal] = dv_proposal();

    $response = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/documents", [
            'file' => UploadedFile::fake()->create('proposal.pdf', 100),
            'document_type' => 'proposal_document',
        ])
        ->assertCreated();

    expect($response->json('data.version'))->toBe(1);

    $doc = ProposalDocument::where('proposal_id', $proposal->id)->first();
    expect($doc->version)->toBe(1)
        ->and($doc->is_current)->toBeTrue();
});

test('re-uploading the same document type supersedes the previous version instead of just adding a sibling', function () {
    [$pi, $proposal] = dv_proposal();

    $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('v1.pdf', 100),
        'document_type' => 'proposal_document',
    ])->assertCreated();

    $v1 = ProposalDocument::where('proposal_id', $proposal->id)->first();

    $response = $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('v2.pdf', 100),
        'document_type' => 'proposal_document',
    ])->assertCreated();

    expect($response->json('data.version'))->toBe(2)
        ->and($response->json('message'))->toContain('version 2')
        ->and($v1->fresh()->is_current)->toBeFalse()
        ->and(ProposalDocument::where('proposal_id', $proposal->id)->count())->toBe(2);

    $current = ProposalDocument::where('proposal_id', $proposal->id)->where('is_current', true)->first();
    expect($current->version)->toBe(2)
        ->and($current->original_filename)->toBe('v2.pdf');
});

test('versioning is scoped per document type — uploading a CV does not touch the proposal document version', function () {
    [$pi, $proposal] = dv_proposal();

    $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('proposal.pdf', 100),
        'document_type' => 'proposal_document',
    ])->assertCreated();

    $response = $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('cv.pdf', 100),
        'document_type' => 'pi_cv',
    ])->assertCreated();

    expect($response->json('data.version'))->toBe(1);
    expect(ProposalDocument::where('proposal_id', $proposal->id)->where('is_current', true)->count())->toBe(2);
});

test('deleting the current version restores the previous version as current', function () {
    [$pi, $proposal] = dv_proposal();

    $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('v1.pdf', 100),
        'document_type' => 'proposal_document',
    ])->assertCreated();
    $v1 = ProposalDocument::where('proposal_id', $proposal->id)->first();

    $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('v2.pdf', 100),
        'document_type' => 'proposal_document',
    ])->assertCreated();
    $v2 = ProposalDocument::where('proposal_id', $proposal->id)->where('version', 2)->first();

    $this->actingAs($pi, 'sanctum')
        ->deleteJson("/api/v1/proposals/{$proposal->id}/documents/{$v2->id}")
        ->assertOk();

    expect($v1->fresh()->is_current)->toBeTrue();
});

test('a document cannot be deleted once the proposal has been submitted', function () {
    [$pi, $proposal] = dv_proposal();

    $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposals/{$proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('proposal.pdf', 100),
        'document_type' => 'proposal_document',
    ])->assertCreated();
    $doc = ProposalDocument::where('proposal_id', $proposal->id)->first();

    $proposal->update(['status' => 'submitted']);

    $this->actingAs($pi, 'sanctum')
        ->deleteJson("/api/v1/proposals/{$proposal->id}/documents/{$doc->id}")
        ->assertForbidden()
        ->assertJsonPath('message', 'This proposal has already been submitted — its documents can no longer be deleted.');

    expect(ProposalDocument::find($doc->id))->not->toBeNull();
});
