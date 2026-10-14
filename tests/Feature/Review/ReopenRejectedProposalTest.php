<?php

use App\Exceptions\InvalidTransitionException;
use App\Jobs\SendEmailNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\WorkflowService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
});

function rr_makeProposal(string $status, string $category = 'research'): array
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'RR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RRD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => $category,
        'title' => 'Call', 'slug' => 'rr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'RR-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => $category,
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $central, $pi];
}

function rr_rejectVia(Proposal $proposal, string $action, User $actor): Proposal
{
    return app(WorkflowService::class)->transition($proposal, $action, $actor, 'Rejected for test setup.');
}

// ─── WorkflowService::reopenRejectedProposal() — correct destination per origin ──

test('a proposal rejected from submitted reopens back to submitted', function () {
    [$proposal, $central] = rr_makeProposal('submitted');
    rr_rejectVia($proposal, 'reject', $central);

    $reopened = app(WorkflowService::class)->reopenRejectedProposal($proposal->fresh(), $central, 'Reconsidering under corrected settings.');

    expect($reopened->status)->toBe('submitted');
});

test('a proposal rejected from validated reopens back to validated', function () {
    [$proposal, $central] = rr_makeProposal('validated');
    rr_rejectVia($proposal, 'reject', $central);

    $reopened = app(WorkflowService::class)->reopenRejectedProposal($proposal->fresh(), $central, 'Reconsidering under corrected settings.');

    expect($reopened->status)->toBe('validated');
});

test('a proposal rejected from under_blind_review reopens back to under_blind_review', function () {
    [$proposal, $central] = rr_makeProposal('under_blind_review');
    rr_rejectVia($proposal, 'fail_blind_review', $central);

    $reopened = app(WorkflowService::class)->reopenRejectedProposal($proposal->fresh(), $central, 'Reconsidering under corrected settings.');

    expect($reopened->status)->toBe('under_blind_review');
});

test('a proposal rejected from blind_review_passed reopens back to blind_review_passed', function () {
    [$proposal, $central] = rr_makeProposal('blind_review_passed');
    rr_rejectVia($proposal, 'fail_blind_review', $central);

    $reopened = app(WorkflowService::class)->reopenRejectedProposal($proposal->fresh(), $central, 'Reconsidering under corrected settings.');

    expect($reopened->status)->toBe('blind_review_passed');
});

test('a proposal rejected from under_open_defence reopens back to under_open_defence', function () {
    [$proposal, $central] = rr_makeProposal('under_open_defence');
    rr_rejectVia($proposal, 'fail_defence', $central);

    $reopened = app(WorkflowService::class)->reopenRejectedProposal($proposal->fresh(), $central, 'Threshold settings were wrong at decision time.');

    expect($reopened->status)->toBe('under_open_defence');
});

test('a proposal rejected from accepted (central reject) reopens back to accepted', function () {
    [$proposal, $central] = rr_makeProposal('accepted');
    rr_rejectVia($proposal, 'central_reject', $central);

    $reopened = app(WorkflowService::class)->reopenRejectedProposal($proposal->fresh(), $central, 'Reconsidering under corrected settings.');

    expect($reopened->status)->toBe('accepted');
});

test('a proposal that is not currently rejected cannot be reopened', function () {
    [$proposal, $central] = rr_makeProposal('under_blind_review');

    expect(fn () => app(WorkflowService::class)->reopenRejectedProposal($proposal, $central, 'Not actually rejected.'))
        ->toThrow(InvalidTransitionException::class);
});

// ─── HTTP endpoint ─────────────────────────────────────────────────────────────

test('a central_officer can reopen a rejected proposal via the API', function () {
    Queue::fake();
    [$proposal, $central] = rr_makeProposal('under_open_defence');
    rr_rejectVia($proposal, 'fail_defence', $central);

    $response = $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/reopen", ['reason' => 'Threshold settings were wrong at decision time.']);

    $response->assertOk()->assertJsonPath('data.status', 'under_open_defence');
});

test('a reviewer cannot reopen a rejected proposal', function () {
    [$proposal, $central] = rr_makeProposal('under_open_defence');
    rr_rejectVia($proposal, 'fail_defence', $central);
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/reopen", ['reason' => 'Trying to reopen without permission.'])
        ->assertStatus(403);
});

test('a college_officer cannot reopen a rejected proposal', function () {
    [$proposal, $central] = rr_makeProposal('under_open_defence');
    rr_rejectVia($proposal, 'fail_defence', $central);
    $officer = User::factory()->create();
    $officer->assignRole('college_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/reopen", ['reason' => 'Trying to reopen without permission.'])
        ->assertStatus(403);
});

test('reopening requires a reason of at least 10 characters', function () {
    [$proposal, $central] = rr_makeProposal('under_open_defence');
    rr_rejectVia($proposal, 'fail_defence', $central);

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/reopen", ['reason' => 'short'])
        ->assertStatus(422);
});

test('reopening a proposal that is not rejected returns a 422', function () {
    [$proposal, $central] = rr_makeProposal('validated');

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/reopen", ['reason' => 'Proposal is not actually rejected.'])
        ->assertStatus(422);
});

test('reopening notifies the PI with an accurate reconsideration message, not the generic decision copy', function () {
    Queue::fake();
    [$proposal, $central, $pi] = rr_makeProposal('under_open_defence');
    rr_rejectVia($proposal, 'fail_defence', $central);

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/reopen", ['reason' => 'Threshold settings were wrong at decision time.'])
        ->assertOk();

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pi->id
        && $job->event === 'decision_result'
        && $job->data['decision'] === 'reopened'
        && str_contains($job->data['reason'], 'reconsidered'));
});
