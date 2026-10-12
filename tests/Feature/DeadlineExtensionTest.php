<?php

use App\Exceptions\IncompleteProposalException;
use App\Exceptions\WorkflowGuardException;
use App\Models\College;
use App\Models\DeadlineExtensionRequest;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\ProposalService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function det_proposalWithStatus(string $status, ?string $callEndDate = null): array
{
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $admin = User::factory()->create();
    $call = ProposalCall::create([
        'academic_year' => '2024/25', 'category' => 'research',
        'title' => 'Test Call', 'slug' => 'det-call-'.rand(10000, 99999),
        'start_date' => now()->subMonth()->toDateString(),
        'end_date' => $callEndDate ?? now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'id' => (string) Str::uuid(),
        'tracker_number' => 'RTT-'.rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'title' => 'Test Proposal',
        'abstract' => 'Test abstract content.',
        'status' => $status,
        'category' => 'research',
        'academic_year' => '2024/25',
        'created_by' => $pi->id,
    ]);

    return [$pi, $proposal, $call];
}

test('PI can request a deadline extension on a draft proposal', function () {
    [$pi, $proposal] = det_proposalWithStatus('draft');

    $res = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/deadline-extension", [
            'reason' => 'My co-investigator was hospitalized and we need more time to finish.',
            'requested_until' => now()->addDays(14)->toDateTimeString(),
        ]);

    $res->assertStatus(201)->assertJsonPath('data.status', 'pending');
    expect(DeadlineExtensionRequest::where('proposal_id', $proposal->id)->exists())->toBeTrue();
});

test('a non-owning PI cannot request an extension on someone else\'s proposal', function () {
    [, $proposal] = det_proposalWithStatus('draft');
    $outsider = User::factory()->create();
    $outsider->assignRole('staff');

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/deadline-extension", [
            'reason' => 'Trying to request extension on a proposal I do not own.',
            'requested_until' => now()->addDays(14)->toDateTimeString(),
        ])
        ->assertStatus(403);
});

test('cannot request an extension on a non-draft proposal', function () {
    [$pi, $proposal] = det_proposalWithStatus('submitted');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/deadline-extension", [
            'reason' => 'This should not be allowed once already submitted.',
            'requested_until' => now()->addDays(14)->toDateTimeString(),
        ])
        ->assertStatus(422);
});

test('cannot submit a duplicate pending extension request', function () {
    [$pi, $proposal] = det_proposalWithStatus('draft');

    DeadlineExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => 'First request reason text here.',
        'requested_until' => now()->addDays(14),
        'status' => 'pending',
    ]);

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/deadline-extension", [
            'reason' => 'Second request attempt should be blocked.',
            'requested_until' => now()->addDays(21)->toDateTimeString(),
        ])
        ->assertStatus(422);
});

test('a requested_until date in the past is rejected', function () {
    [$pi, $proposal] = det_proposalWithStatus('draft');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/deadline-extension", [
            'reason' => 'Requesting a date that has already passed.',
            'requested_until' => now()->subDay()->toDateTimeString(),
        ])
        ->assertStatus(422);
});

test('a reviewer cannot list extension requests', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->getJson('/api/v1/deadline-extensions')
        ->assertStatus(403);
});

test('an officer can approve an extension, granting the proposal a new deadline', function () {
    [$pi, $proposal, $call] = det_proposalWithStatus('draft', now()->subDay()->toDateString());
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $requestedUntil = now()->addDays(10);
    $extension = DeadlineExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => 'Need more time due to unforeseen circumstances.',
        'requested_until' => $requestedUntil,
        'status' => 'pending',
    ]);

    $res = $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/deadline-extensions/{$extension->id}/resolve", [
            'decision' => 'approved',
            'resolution_notes' => 'Approved given the circumstances described.',
        ]);

    $res->assertOk();
    expect($extension->fresh()->status)->toBe('approved')
        ->and($proposal->fresh()->extended_deadline->timestamp)->toBe($requestedUntil->timestamp);
});

test('an officer can grant a different date than what was requested', function () {
    [$pi, $proposal] = det_proposalWithStatus('draft');
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $extension = DeadlineExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => 'Requesting 30 days but officer may grant less.',
        'requested_until' => now()->addDays(30),
        'status' => 'pending',
    ]);

    $grantedUntil = now()->addDays(7);
    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/deadline-extensions/{$extension->id}/resolve", [
            'decision' => 'approved',
            'resolution_notes' => 'Granting a shorter extension than requested.',
            'granted_until' => $grantedUntil->toDateTimeString(),
        ])
        ->assertOk();

    expect($proposal->fresh()->extended_deadline->timestamp)->toBe($grantedUntil->timestamp);
});

test('an officer can deny an extension, leaving the proposal deadline untouched', function () {
    [$pi, $proposal] = det_proposalWithStatus('draft');
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $extension = DeadlineExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => 'Reason for the extension request.',
        'requested_until' => now()->addDays(10),
        'status' => 'pending',
    ]);

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/deadline-extensions/{$extension->id}/resolve", [
            'decision' => 'denied',
            'resolution_notes' => 'The original deadline stands.',
        ])
        ->assertOk();

    expect($extension->fresh()->status)->toBe('denied')
        ->and($proposal->fresh()->extended_deadline)->toBeNull();
});

test('cannot resolve an extension request twice', function () {
    [$pi, $proposal] = det_proposalWithStatus('draft');
    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $extension = DeadlineExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => 'Reason for the extension request.',
        'requested_until' => now()->addDays(10),
        'status' => 'approved',
        'resolved_by' => $officer->id,
        'resolved_at' => now(),
    ]);

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/deadline-extensions/{$extension->id}/resolve", [
            'decision' => 'denied',
            'resolution_notes' => 'Trying to change the decision after the fact.',
        ])
        ->assertStatus(422);
});

test('a proposal with an approved extension clears the deadline gate after the call expired', function () {
    // Deliberately doesn't satisfy budget/document/co-investigator completeness — this
    // test only asserts the deadline gate itself (the very first check in submit())
    // was cleared by the extension, not that submission fully succeeds end-to-end.
    [$pi, $proposal] = det_proposalWithStatus('draft', now()->subDay()->toDateString());
    $proposal->update(['extended_deadline' => now()->addDays(5)]);

    try {
        app(ProposalService::class)->submit($proposal->fresh(), $pi);
    } catch (WorkflowGuardException $e) {
        expect($e->getMessage())->not->toContain('submission deadline');
    } catch (IncompleteProposalException $e) {
        // Expected: got past the deadline gate, failed on a later completeness check instead.
        expect(true)->toBeTrue();
    }
});

test('a proposal detail response exposes extended_deadline to its PI', function () {
    [$pi, $proposal] = det_proposalWithStatus('draft');
    $granted = now()->addDays(10);
    $proposal->update(['extended_deadline' => $granted]);

    $res = $this->actingAs($pi, 'sanctum')->getJson("/api/v1/proposals/{$proposal->id}");

    $res->assertOk();
    expect(Carbon::parse($res->json('data.extended_deadline'))->timestamp)->toBe($granted->timestamp);
});

test('a proposal without an extension cannot be submitted after the call expired', function () {
    [$pi, $proposal] = det_proposalWithStatus('draft', now()->subDay()->toDateString());

    expect(fn () => app(ProposalService::class)->submit($proposal->fresh(), $pi))
        ->toThrow(WorkflowGuardException::class);
});
