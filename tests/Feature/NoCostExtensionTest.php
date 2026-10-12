<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\NoCostExtensionRequest;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function nce_proposal(string $status = 'funded', string $category = 'research', int $duration = 12): array
{
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $admin = User::factory()->create();
    $call = ProposalCall::create([
        'academic_year' => '2024/25', 'category' => $category,
        'title' => 'Test Call', 'slug' => 'nce-call-'.rand(10000, 99999),
        'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
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
        'category' => $category,
        'academic_year' => '2024/25',
        'created_by' => $pi->id,
        'duration_months' => $duration,
    ]);

    return [$pi, $proposal];
}

// ─── store() ─────────────────────────────────────────────────────────────────

test('a PI can request a no-cost extension on a funded proposal', function () {
    Queue::fake();
    [$pi, $proposal] = nce_proposal();

    $response = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/no-cost-extension", [
            'reason' => str_repeat('a', 25),
            'requested_duration_months' => 18,
        ]);

    $response->assertStatus(201)->assertJsonPath('data.status', 'pending');
    expect(NoCostExtensionRequest::where('proposal_id', $proposal->id)->count())->toBe(1);
});

test('a non-owning PI cannot request a no-cost extension', function () {
    [, $proposal] = nce_proposal();
    $outsider = User::factory()->create();
    $outsider->assignRole('staff');

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/no-cost-extension", [
            'reason' => str_repeat('a', 25),
            'requested_duration_months' => 18,
        ])
        ->assertStatus(403);
});

test('a no-cost extension cannot be requested for a proposal that is not funded or in midterm', function () {
    [$pi, $proposal] = nce_proposal(status: 'draft');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/no-cost-extension", [
            'reason' => str_repeat('a', 25),
            'requested_duration_months' => 18,
        ])
        ->assertStatus(422);
});

test('the requested duration must be longer than the current duration', function () {
    [$pi, $proposal] = nce_proposal(duration: 12);

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/no-cost-extension", [
            'reason' => str_repeat('a', 25),
            'requested_duration_months' => 12,
        ])
        ->assertStatus(422);
});

test('a second no-cost extension cannot be requested while one is still pending', function () {
    [$pi, $proposal] = nce_proposal(duration: 12);
    NoCostExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_duration_months' => 12,
        'requested_duration_months' => 18,
        'status' => 'pending',
    ]);

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/no-cost-extension", [
            'reason' => str_repeat('a', 25),
            'requested_duration_months' => 24,
        ])
        ->assertStatus(422);
});

test('requesting an extension notifies the category officer', function () {
    Queue::fake();
    [$pi, $proposal] = nce_proposal(category: 'research');
    $officer = User::factory()->create();
    $officer->assignRole('research_officer');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/no-cost-extension", [
            'reason' => str_repeat('a', 25),
            'requested_duration_months' => 18,
        ])
        ->assertStatus(201);

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $officer->id && $job->event === 'no_cost_extension_requested');
});

// ─── index() ─────────────────────────────────────────────────────────────────

test('a reviewer cannot list no-cost extension requests', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->getJson('/api/v1/no-cost-extensions')
        ->assertStatus(403);
});

test('an officer can list no-cost extension requests', function () {
    [$pi, $proposal] = nce_proposal(duration: 12);
    NoCostExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_duration_months' => 12,
        'requested_duration_months' => 18,
        'status' => 'pending',
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $response = $this->actingAs($officer, 'sanctum')->getJson('/api/v1/no-cost-extensions')->assertOk();

    expect(collect($response->json('data.data'))->pluck('proposal_id'))->toContain($proposal->id);
});

// ─── approve() ───────────────────────────────────────────────────────────────

test('an officer can approve a pending no-cost extension and the duration is extended', function () {
    Queue::fake();
    [$pi, $proposal] = nce_proposal(duration: 12);
    $extension = NoCostExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_duration_months' => 12,
        'requested_duration_months' => 18,
        'status' => 'pending',
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/no-cost-extensions/{$extension->id}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    expect($extension->fresh()->resolved_by)->toBe($officer->id)
        ->and($proposal->fresh()->duration_months)->toBe(18);

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pi->id && $job->event === 'no_cost_extension_resolved');
});

test('cannot approve a no-cost extension that is already resolved', function () {
    [$pi, $proposal] = nce_proposal(duration: 12);
    $extension = NoCostExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_duration_months' => 12,
        'requested_duration_months' => 18,
        'status' => 'approved',
        'resolved_at' => now(),
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/no-cost-extensions/{$extension->id}/approve")
        ->assertStatus(422);
});

test('a reviewer cannot approve a no-cost extension', function () {
    [$pi, $proposal] = nce_proposal(duration: 12);
    $extension = NoCostExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_duration_months' => 12,
        'requested_duration_months' => 18,
        'status' => 'pending',
    ]);

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/no-cost-extensions/{$extension->id}/approve")
        ->assertStatus(403);
});

// ─── reject() ────────────────────────────────────────────────────────────────

test('an officer can reject a pending no-cost extension with a reason, leaving the duration untouched', function () {
    Queue::fake();
    [$pi, $proposal] = nce_proposal(duration: 12);
    $extension = NoCostExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_duration_months' => 12,
        'requested_duration_months' => 18,
        'status' => 'pending',
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/no-cost-extensions/{$extension->id}/reject", [
            'reason' => 'Insufficient justification provided.',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'denied');

    expect($proposal->fresh()->duration_months)->toBe(12);
    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pi->id && $job->event === 'no_cost_extension_resolved');
});

test('rejecting a no-cost extension without a reason is rejected', function () {
    [$pi, $proposal] = nce_proposal(duration: 12);
    $extension = NoCostExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_duration_months' => 12,
        'requested_duration_months' => 18,
        'status' => 'pending',
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/no-cost-extensions/{$extension->id}/reject", [])
        ->assertStatus(422);
});

// ─── show() ──────────────────────────────────────────────────────────────────

test('a PI can view their proposal\'s latest no-cost extension request', function () {
    [$pi, $proposal] = nce_proposal(duration: 12);
    NoCostExtensionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_duration_months' => 12,
        'requested_duration_months' => 18,
        'status' => 'pending',
    ]);

    $this->actingAs($pi, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/no-cost-extension")
        ->assertOk()
        ->assertJsonPath('data.status', 'pending');
});
