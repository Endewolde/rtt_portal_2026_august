<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function plc_base(): array
{
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $college = College::create(['name' => 'PLC College '.rand(), 'code' => 'PLC'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'PLCD'.rand(10, 99)]);

    return [$superAdmin, $college, $dept];
}

function plc_call(User $creator, string $status, string $endDate): ProposalCall
{
    return ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'plc-'.rand(10000, 99999),
        'start_date' => now()->subMonths(3)->toDateString(), 'end_date' => $endDate,
        'status' => $status, 'is_open' => $status === 'active', 'created_by' => $creator->id,
    ]);
}

// ─── rtt:expire-calls ────────────────────────────────────────────────────────

test('expire-calls marks a past-deadline active call as expired and closes it', function () {
    [$superAdmin] = plc_base();
    $expiredCall = plc_call($superAdmin, 'active', now()->subDay()->toDateString());
    $stillOpenCall = plc_call($superAdmin, 'active', now()->addMonth()->toDateString());

    Artisan::call('rtt:expire-calls');

    expect($expiredCall->fresh()->status)->toBe('expired')
        ->and($expiredCall->fresh()->is_open)->toBeFalse()
        ->and($stillOpenCall->fresh()->status)->toBe('active');
});

test('expire-calls does not touch a call that is already closed', function () {
    [$superAdmin] = plc_base();
    $closedCall = plc_call($superAdmin, 'closed', now()->subDay()->toDateString());

    Artisan::call('rtt:expire-calls');

    expect($closedCall->fresh()->status)->toBe('closed');
});

// ─── rtt:open-for-validation ─────────────────────────────────────────────────
//
// NOTE: this command's second half (surfacing proposals into the validation
// queue) is dead code — it filters on Proposal.status = 'pending_validation'
// and transitions via a workflow action named 'open_for_validation', but
// neither that status nor that action exists anywhere else in the app. The
// real validation queue (ProposalValidationService::getValidationQueue) runs
// off status = 'submitted' directly. This command WAS scheduled hourly
// (bootstrap/app.php), racing rtt:expire-calls (which runs every minute) on
// the same rows — it has since been removed from the schedule for that reason;
// see OpenProposalsForValidation's class docblock. Documenting the command's
// actual behavior here rather than its originally-intended one.

test('open-for-validation closes an expired active call (the part that works)', function () {
    [$superAdmin] = plc_base();
    $expiredCall = plc_call($superAdmin, 'active', now()->subDay()->toDateString());

    Artisan::call('rtt:open-for-validation');

    expect($expiredCall->fresh()->status)->toBe('closed')
        ->and($expiredCall->fresh()->is_open)->toBeFalse();
});

test('open-for-validation does not advance a submitted proposal under an expired call — the intended feature is dead', function () {
    [$superAdmin, $college, $dept] = plc_base();
    $call = plc_call($superAdmin, 'active', now()->subDay()->toDateString());

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $proposal = Proposal::create([
        'tracker_number' => 'PLC-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'submitted',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    Artisan::call('rtt:open-for-validation');

    // Status is untouched — the command only ever looks for 'pending_validation',
    // which this proposal (and every real proposal) never has.
    expect($proposal->fresh()->status)->toBe('submitted');
});

test('open-for-validation reports no expired calls when none exist', function () {
    [$superAdmin] = plc_base();
    plc_call($superAdmin, 'active', now()->addMonth()->toDateString());

    Artisan::call('rtt:open-for-validation');

    expect(Artisan::output())->toContain('No expired calls found.');
});
