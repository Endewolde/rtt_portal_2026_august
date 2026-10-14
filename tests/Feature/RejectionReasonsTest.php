<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Support\RejectionReasons;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
});

function rr_proposal(object $ctx, string $status): Proposal
{
    $college = College::create(['name' => 'C'.rand(), 'code' => 'RR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RRD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'rr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $ctx->central->id,
    ]);
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    return Proposal::create([
        'tracker_number' => 'RR-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

test('every catalog label is long enough for the endpoints\' minimum reason length', function () {
    foreach (RejectionReasons::CATALOG as $context => $reasons) {
        expect($reasons)->toHaveKey(RejectionReasons::OTHER);
        foreach ($reasons as $code => $label) {
            if ($code !== RejectionReasons::OTHER) {
                expect(mb_strlen($label))->toBeGreaterThanOrEqual(10, "{$context}.{$code}");
            }
        }
    }
});

test('a listed reason with details is saved as "Label — details" and sent to the PI', function () {
    $proposal = rr_proposal($this, 'submitted');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/validation/reject", [
            'reason_code' => 'not_anonymous', 'reason' => 'PI name appears on the cover page.',
        ])
        ->assertOk();

    $proposal->refresh();
    expect($proposal->status)->toBe('rejected')
        ->and($proposal->rejection_reason)->toBe('Not anonymous — author identity revealed — PI name appears on the cover page.');

    $notice = DB::table('notifications')->where('notifiable_id', $proposal->pi_user_id)->where('type', 'decision_result')->first();
    expect(json_decode($notice->data, true)['reason'])->toBe($proposal->rejection_reason);
});

test('a listed reason needs no details', function () {
    $proposal = rr_proposal($this, 'submitted');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/validation/reject", ['reason_code' => 'incomplete_submission'])
        ->assertOk();

    expect($proposal->fresh()->rejection_reason)->toBe('Incomplete submission');
});

test('"other" requires a description, and unknown codes are refused', function () {
    $proposal = rr_proposal($this, 'submitted');
    $reject = fn (array $payload) => $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/validation/reject", $payload);

    $reject(['reason_code' => 'other'])->assertStatus(422)->assertJsonValidationErrors('reason');
    $reject(['reason_code' => 'other', 'reason' => 'short'])->assertStatus(422)->assertJsonValidationErrors('reason');
    $reject(['reason_code' => 'funds_unavailable'])->assertStatus(422)->assertJsonValidationErrors('reason_code');

    $reject(['reason_code' => 'other', 'reason' => 'Submitted to the wrong call entirely.'])->assertOk();
    expect($proposal->fresh()->rejection_reason)->toBe('Submitted to the wrong call entirely.');
});

test('free-text reasons without a code still work as before', function () {
    $proposal = rr_proposal($this, 'submitted');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/validation/reject", ['reason' => 'Plain reason without a code.'])
        ->assertOk();

    expect($proposal->fresh()->rejection_reason)->toBe('Plain reason without a code.');
});

test('rejecting from blind review records the reason the PI is shown', function () {
    $proposal = rr_proposal($this, 'under_blind_review');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/blind-review/reject", [
            'reason_code' => 'plagiarism', 'reason' => 'Section 3 copied from a 2021 thesis.',
        ])
        ->assertOk();

    $proposal->refresh();
    expect($proposal->status)->toBe('rejected')
        ->and($proposal->rejection_reason)->toBe('Plagiarism or high similarity — Section 3 copied from a 2021 thesis.');
});

test('central evaluation uses its own reason list', function () {
    $proposal = rr_proposal($this, 'accepted');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/central/reject", ['reason_code' => 'funds_unavailable'])
        ->assertOk();

    expect($proposal->fresh()->rejection_reason)->toBe('Insufficient funds in this round');
});
