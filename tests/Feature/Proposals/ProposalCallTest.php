<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\ProposalCallService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole('central_officer');

    return $user;
}

function makeCall(array $overrides = []): ProposalCall
{
    $admin = makeAdmin();

    return ProposalCall::create(array_merge([
        'academic_year' => '2026-2027',
        'category' => 'research',
        'title' => 'Test Call '.rand(1, 9999),
        'slug' => 'test-call-'.rand(10000, 99999),
        'start_date' => now()->toDateTimeString(),
        'end_date' => now()->addMonths(3)->toDateTimeString(),
        'status' => 'draft',
        'is_open' => false,
        'created_by' => $admin->id,
    ], $overrides));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('can create proposal call with valid data', function () {
    $admin = makeAdmin();

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/proposal-calls', [
            'academic_year' => '2026-2027',
            'category' => 'research',
            'title' => 'Annual Research Grant',
            'start_date' => now()->format('Y-m-d\TH:i'),
            'end_date' => now()->addMonths(3)->format('Y-m-d\TH:i'),
        ]);

    $response->assertCreated()
        ->assertJsonPath('message', 'Proposal call created.');

    $this->assertDatabaseHas('proposal_calls', ['title' => 'Annual Research Grant']);
});

test('cannot activate call with past end_date', function () {
    $service = app(ProposalCallService::class);
    $call = makeCall(['end_date' => now()->subDay()->toDateTimeString()]);

    expect(fn () => $service->activate($call))
        ->toThrow(Exception::class, 'end date is in the past');
});

test('active call with submissions cannot change category', function () {
    $service = app(ProposalCallService::class);
    $admin = makeAdmin();

    $call = makeCall(['status' => 'active', 'is_open' => true]);

    // Create a submitted proposal (non-draft)
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'Test College', 'code' => 'TC01']);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'Test Dept', 'code' => 'TD01']);

    Proposal::create([
        'tracker_number' => 'TRK-00001',
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'Test Proposal',
        'status' => 'submitted',
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026/2027',
        'created_by' => $pi->id,
    ]);

    expect(fn () => $service->update($call, ['category' => 'innovation'], $admin))
        ->toThrow(Exception::class, 'Cannot change category');
});

test('listActive only returns active and is_open=true calls', function () {
    $service = app(ProposalCallService::class);

    makeCall(['status' => 'active', 'is_open' => true]);
    makeCall(['status' => 'active', 'is_open' => true]);
    makeCall(['status' => 'draft',  'is_open' => false]);
    makeCall(['status' => 'closed', 'is_open' => false]);

    $results = $service->listActive();

    expect($results->total())->toBe(2);
    expect($results->items())->each(fn ($call) => $call->status->toBe('active'));
});

test('a call can be copied into a draft for the next academic year', function () {
    Storage::fake('private');
    $source = makeCall([
        'title' => 'Research Grants 2026-2027', 'status' => 'active', 'is_open' => true,
        'description' => 'Fund applied research.', 'eligibility' => 'Permanent staff', 'funding_budget' => 2500000,
        'max_proposals_per_pi' => 2, 'start_date' => '2026-09-01 08:00:00', 'end_date' => '2026-11-30 17:00:00',
        'guidelines_file' => 'proposal-calls/source/guidelines/g.pdf',
    ]);
    Storage::disk('private')->put('proposal-calls/source/guidelines/g.pdf', 'PDF');

    $response = $this->actingAs(makeAdmin(), 'sanctum')->postJson("/api/v1/proposal-calls/{$source->id}/copy")->assertCreated();

    $copy = ProposalCall::findOrFail($response->json('data.id'));
    expect($copy->title)->toBe('Research Grants 2027-2028')
        ->and($copy->academic_year)->toBe('2027-2028')
        ->and($copy->status)->toBe('draft')
        ->and($copy->is_open)->toBeFalse()
        ->and($copy->description)->toBe('Fund applied research.')
        ->and((float) $copy->funding_budget)->toBe(2500000.0)
        ->and($copy->max_proposals_per_pi)->toBe(2)
        ->and($copy->start_date->toDateString())->toBe('2027-09-01')
        ->and($copy->end_date->toDateString())->toBe('2027-11-30')
        ->and($copy->guidelines_file)->not->toBe($source->guidelines_file);
    Storage::disk('private')->assertExists($copy->guidelines_file);
});

test('a copied call takes the title, year and dates it is given', function () {
    $source = makeCall(['title' => 'Community Call']);

    $response = $this->actingAs(makeAdmin(), 'sanctum')->postJson("/api/v1/proposal-calls/{$source->id}/copy", [
        'title' => 'Community Call — Round 2', 'academic_year' => '2028-2029',
        'start_date' => '2028-10-01 09:00', 'end_date' => '2028-12-01 17:00',
    ])->assertCreated();

    expect($response->json('data.title'))->toBe('Community Call — Round 2')
        ->and($response->json('data.academic_year'))->toBe('2028-2029');
});

test('only people who can create calls can copy one', function () {
    $source = makeCall();
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')->postJson("/api/v1/proposal-calls/{$source->id}/copy")->assertForbidden();
});
