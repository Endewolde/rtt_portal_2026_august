<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\RepositoryRecord;
use App\Models\User;
use App\Models\WorkflowLog;
use App\Services\RepositoryService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function repo_makeCollege(string $suffix = ''): array
{
    $college = College::create(['name' => 'Repo College '.$suffix.rand(), 'code' => 'RC'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RD'.rand(10, 99)]);

    return [$college, $dept];
}

function repo_makeProposal(College $college, Department $dept, array $attrs = []): Proposal
{
    $central = User::factory()->create(); $central->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'repo-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return Proposal::create(array_merge([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'Repository Proposal', 'status' => 'completed',
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ], $attrs));
}

function repo_makeRecord(Proposal $proposal, array $attrs = []): RepositoryRecord
{
    return RepositoryRecord::create(array_merge([
        'proposal_id'  => $proposal->id,
        'title'        => $proposal->title ?? 'Default Title',
        'abstract'     => 'Abstract text for testing repository search.',
        'keywords'     => 'testing search keyword',
        'category'     => $proposal->category ?? 'research',
        'college_id'   => $proposal->college_id,
        'pi_name'      => 'Dr. Test PI',
        'academic_year'=> $proposal->academic_year ?? '2026',
        'status'       => 'published',
    ], $attrs));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('search returns published repository records', function () {
    [$college, $dept] = repo_makeCollege();
    $p1 = repo_makeProposal($college, $dept);
    $p2 = repo_makeProposal($college, $dept);
    repo_makeRecord($p1);
    repo_makeRecord($p2);

    $results = app(RepositoryService::class)->search([]);

    expect($results->total())->toBe(2);
});

test('full-text search filters by query term', function () {
    [$college, $dept] = repo_makeCollege();

    $p1 = repo_makeProposal($college, $dept, ['title' => 'Quantum Physics Research']);
    $p2 = repo_makeProposal($college, $dept, ['title' => 'Agricultural Water Management Systems']);

    repo_makeRecord($p1, ['title' => 'Quantum Physics Research', 'keywords' => 'quantum physics']);
    repo_makeRecord($p2, ['title' => 'Agricultural Water Management Systems', 'keywords' => 'agriculture water']);

    $results = app(RepositoryService::class)->search(['q' => 'quantum']);

    expect($results->total())->toBe(1)
        ->and($results->items()[0]->title)->toContain('Quantum');
});

test('category filter works correctly', function () {
    [$college, $dept] = repo_makeCollege();

    $p1 = repo_makeProposal($college, $dept, ['category' => 'research']);
    $p2 = repo_makeProposal($college, $dept, ['category' => 'innovation']);

    repo_makeRecord($p1, ['category' => 'research']);
    repo_makeRecord($p2, ['category' => 'innovation']);

    $results = app(RepositoryService::class)->search(['category' => 'innovation']);

    expect($results->total())->toBe(1)
        ->and($results->items()[0]->category)->toBe('innovation');
});

test('college filter works correctly', function () {
    [$college1, $dept1] = repo_makeCollege('A');
    [$college2, $dept2] = repo_makeCollege('B');

    $p1 = repo_makeProposal($college1, $dept1);
    $p2 = repo_makeProposal($college2, $dept2);

    repo_makeRecord($p1);
    repo_makeRecord($p2);

    $results = app(RepositoryService::class)->search(['college_id' => $college1->id]);

    expect($results->total())->toBe(1)
        ->and($results->items()[0]->college_id)->toBe($college1->id);
});

test('academic year filter works correctly', function () {
    [$college, $dept] = repo_makeCollege();

    $p1 = repo_makeProposal($college, $dept, ['academic_year' => '2024']);
    $p2 = repo_makeProposal($college, $dept, ['academic_year' => '2026']);

    repo_makeRecord($p1, ['academic_year' => '2024']);
    repo_makeRecord($p2, ['academic_year' => '2026']);

    $results = app(RepositoryService::class)->search(['academic_year' => '2026']);

    expect($results->total())->toBe(1)
        ->and($results->items()[0]->academic_year)->toBe('2026');
});

test('tracker lookup returns correct current status', function () {
    [$college, $dept] = repo_makeCollege();
    $proposal = repo_makeProposal($college, $dept, ['tracker_number' => 'RES-2026-000001', 'status' => 'submitted']);

    $data = app(RepositoryService::class)->getTrackerStatus('RES-2026-000001');

    expect($data['tracker_number'])->toBe('RES-2026-000001')
        ->and($data['current_status'])->toBe('submitted');
});

test('tracker lookup history is anonymized — no reviewer real names', function () {
    [$college, $dept] = repo_makeCollege();
    $proposal = repo_makeProposal($college, $dept, ['tracker_number' => 'RES-2026-ANON']);

    $reviewer = User::factory()->create(['name' => 'Dr. John Doe Secret Reviewer']);
    $reviewer->assignRole('reviewer');

    WorkflowLog::create([
        'proposal_id' => $proposal->id,
        'from_stage'  => 'submitted',
        'action'      => 'assign_reviewer',
        'to_stage'    => 'blind_review',
        'actor_id'    => $reviewer->id,
        'notes'       => 'Assigned',
    ]);

    $data = app(RepositoryService::class)->getTrackerStatus('RES-2026-ANON');

    $actors = collect($data['history'])->pluck('actor')->toArray();

    expect($actors)->not->toContain('Dr. John Doe Secret Reviewer');
    expect(in_array('Reviewer A', $actors))->toBeTrue();
});

test('tracker lookup returns RTT Office for central office actions', function () {
    [$college, $dept] = repo_makeCollege();
    $proposal = repo_makeProposal($college, $dept, ['tracker_number' => 'RES-2026-CENT']);

    $central = User::factory()->create(); $central->assignRole('central_officer');

    WorkflowLog::create([
        'proposal_id' => $proposal->id,
        'from_stage'  => 'draft',
        'action'      => 'submit',
        'to_stage'    => 'submitted',
        'actor_id'    => $central->id,
        'notes'       => 'Validated',
    ]);

    $data = app(RepositoryService::class)->getTrackerStatus('RES-2026-CENT');

    $actors = collect($data['history'])->pluck('actor')->toArray();

    expect(in_array('RTT Office', $actors))->toBeTrue();
});

test('tracker lookup returns Principal Investigator for PI actions', function () {
    [$college, $dept] = repo_makeCollege();

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $proposal = Proposal::create([
        'tracker_number'   => 'RES-2026-PI01',
        'proposal_call_id' => ProposalCall::create([
            'academic_year' => '2026', 'category' => 'research', 'title' => 'C',
            'slug' => 'pi01-'.rand(), 'start_date' => now()->toDateString(),
            'end_date' => now()->addMonths(3)->toDateString(),
            'status' => 'active', 'is_open' => true, 'created_by' => $pi->id,
        ])->id,
        'category' => 'research', 'title' => 'PI Proposal', 'status' => 'submitted',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    WorkflowLog::create([
        'proposal_id' => $proposal->id,
        'from_stage'  => 'draft',
        'action'      => 'submit',
        'to_stage'    => 'submitted',
        'actor_id'    => $pi->id,
        'notes'       => 'Submitted by PI',
    ]);

    $data = app(RepositoryService::class)->getTrackerStatus('RES-2026-PI01');

    $actors = collect($data['history'])->pluck('actor')->toArray();

    expect(in_array('Principal Investigator', $actors))->toBeTrue();
});

test('non-existent tracker number throws exception', function () {
    expect(fn () => app(RepositoryService::class)->getTrackerStatus('NONEXISTENT-9999'))
        ->toThrow(\Exception::class, 'not found');
});
