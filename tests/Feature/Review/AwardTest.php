<?php

use App\Models\Award;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\AwardService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProposalInStatus(string $status): array
{
    $central = User::factory()->create();
    $central->assignRole('central_office');

    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call    = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'c-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(10000, 99999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'Proposal', 'status' => $status,
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $central];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('can generate award for accepted proposal', function () {
    [$proposal, $central] = makeProposalInStatus('accepted');

    $award = app(AwardService::class)->generate($proposal, $central, 500000.00);

    expect($award)->toBeInstanceOf(Award::class)
        ->and($award->proposal_id)->toBe($proposal->id)
        ->and((float) $award->awarded_amount)->toBe(500000.0);
});

test('award has correct grant reference format GRANT-YYYY-000001', function () {
    [$proposal, $central] = makeProposalInStatus('accepted');

    $award = app(AwardService::class)->generate($proposal, $central, 100000.00);

    $expectedPattern = '/^GRANT-'.now()->year.'-\d{6}$/';
    expect($award->grant_reference)->toMatch($expectedPattern)
        ->and($award->grant_reference)->toBe('GRANT-'.now()->year.'-000001');
});

test('award generation transitions proposal to funded', function () {
    [$proposal, $central] = makeProposalInStatus('accepted');

    app(AwardService::class)->generate($proposal, $central, 250000.00);

    expect(Proposal::find($proposal->id)->status)->toBe('funded');
});

test('cannot generate award for proposal not in accepted state', function () {
    [$proposal, $central] = makeProposalInStatus('submitted'); // wrong state

    expect(fn () => app(AwardService::class)->generate($proposal, $central, 100000.00))
        ->toThrow(\Exception::class, 'accepted state');
});
