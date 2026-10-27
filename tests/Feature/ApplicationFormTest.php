<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalBudget;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\ProposalCallService;
use App\Support\ApplicationForm;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');

    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $this->pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $this->pi->assignRole('staff');

    $this->call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Form Call', 'slug' => 'form-'.rand(10000, 99999),
        'start_date' => now()->subDay(), 'end_date' => now()->addMonth(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->admin->id,
    ]);

    $this->proposal = Proposal::create([
        'tracker_number' => 'DRAFT-'.rand(10000, 99999), 'proposal_call_id' => $this->call->id, 'pi_user_id' => $this->pi->id,
        'college_id' => $college->id, 'department_id' => $dept->id, 'title' => 'With questions', 'abstract' => str_repeat('An abstract. ', 10),
        'status' => 'draft', 'category' => 'research', 'academic_year' => '2026-2027', 'created_by' => $this->pi->id,
        'current_wizard_step' => 1,
    ]);
    ProposalBudget::create(['proposal_id' => $this->proposal->id, 'category' => 'Supplies', 'item_description' => 'Paper', 'amount' => 100]);

    $this->form = [
        'questions' => [
            ['id' => 'community', 'section' => 'Impact', 'label' => 'Which community benefits?', 'type' => 'long_text', 'required' => true, 'max_words' => 5],
            ['id' => 'level', 'label' => 'Level', 'type' => 'select', 'required' => false, 'options' => ['Local', 'National', ' ']],
            ['id' => 'consent', 'label' => 'Consent obtained?', 'type' => 'yes_no', 'required' => false],
        ],
        'documents' => [
            ['key' => 'support_letter', 'label' => 'Letter of support', 'required' => true, 'accept' => 'pdf'],
        ],
    ];
});

test('an admin saves a call application form and it is tidied', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/v1/proposal-calls/{$this->call->id}/application-form", $this->form)
        ->assertOk()
        ->assertJsonPath('data.application_form.questions.0.id', 'community')
        ->assertJsonPath('data.application_form.questions.1.options', ['Local', 'National'])
        ->assertJsonPath('data.application_form.questions.2.max_words', null)
        ->assertJsonPath('data.application_form.documents.0.key', 'support_letter');

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/v1/proposal-calls/{$this->call->id}/application-form", ['questions' => [], 'documents' => []])
        ->assertOk();

    expect($this->call->fresh()->application_form)->toBeNull();
});

test('people who cannot edit calls cannot change the form', function () {
    $this->actingAs($this->pi, 'sanctum')
        ->putJson("/api/v1/proposal-calls/{$this->call->id}/application-form", $this->form)
        ->assertForbidden();
});

test('only answers to the call questions are kept, in the right shape', function () {
    $this->call->update(['application_form' => ApplicationForm::clean($this->form)]);

    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/steps/1", [
        'title' => 'With questions', 'abstract' => str_repeat('An abstract. ', 10),
        'call_answers' => ['community' => 'Farmers nearby', 'level' => 'Galactic', 'consent' => 'true', 'sneaky' => 'x'],
    ])->assertOk();

    expect($this->proposal->fresh()->call_answers)->toEqual(['community' => 'Farmers nearby', 'level' => null, 'consent' => true]);
});

test('a proposal cannot be submitted until the call questions and documents are done', function () {
    Storage::fake('private');
    $this->call->update(['application_form' => ApplicationForm::clean($this->form)]);

    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/submit")
        ->assertUnprocessable()
        ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Which community benefits?') && str_contains($m, 'Letter of support'));

    $this->proposal->update(['call_answers' => ['community' => 'one two three four five six']]);
    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/submit")
        ->assertUnprocessable()
        ->assertJsonPath('message', fn (string $m) => str_contains($m, 'over 5 words'));

    $this->proposal->update(['call_answers' => ['community' => 'Farmers nearby']]);
    $this->actingAs($this->pi, 'sanctum')->post("/api/v1/proposals/{$this->proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('letter.pdf', 50, 'application/pdf'), 'document_type' => 'call_support_letter',
    ], ['Accept' => 'application/json'])->assertSuccessful();

    // Past the call's own checks, the standard ones take over (a co-investigator here).
    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/submit")
        ->assertUnprocessable()
        ->assertJsonPath('message', fn (string $m) => ! str_contains($m, 'This call also asks for'));
});

test('a document type the call does not ask for is refused', function () {
    Storage::fake('private');
    $this->call->update(['application_form' => ApplicationForm::clean($this->form)]);

    $this->actingAs($this->pi, 'sanctum')->post("/api/v1/proposals/{$this->proposal->id}/documents", [
        'file' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'), 'document_type' => 'call_made_up',
    ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('document_type');
});

test('the proposal reads back its answers and a copied call keeps the form', function () {
    $this->call->update(['application_form' => ApplicationForm::clean($this->form)]);
    $this->proposal->update(['call_answers' => ['community' => 'Farmers nearby', 'consent' => false]]);

    $this->actingAs($this->pi, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}")
        ->assertOk()
        ->assertJsonPath('data.call_form_answers.0.answer', 'Farmers nearby')
        ->assertJsonPath('data.call_form_answers.0.section', 'Impact')
        ->assertJsonPath('data.call_form_answers.2.answer', false);

    $copy = app(ProposalCallService::class)->copy($this->call->fresh(), [], $this->admin);
    expect($copy->application_form['documents'][0]['key'])->toBe('support_letter');
});
