<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\BudgetRevisionRequest;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalBudget;
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

function br_proposal(string $status = 'funded', string $category = 'research'): array
{
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('staff');

    $admin = User::factory()->create();
    $call = ProposalCall::create([
        'academic_year' => '2024/25', 'category' => $category,
        'title' => 'Test Call', 'slug' => 'br-call-'.rand(10000, 99999),
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
    ]);

    ProposalBudget::create([
        'proposal_id' => $proposal->id,
        'category' => 'personnel',
        'item_description' => 'Research assistant stipend',
        'amount' => 1000,
    ]);

    return [$pi, $proposal];
}

function br_items(float $amount = 1500): array
{
    return [[
        'category' => 'personnel',
        'item_description' => 'Research assistant stipend',
        'amount' => $amount,
        'justification' => 'Extended fieldwork period.',
    ]];
}

// ─── store() ─────────────────────────────────────────────────────────────────

test('a PI can request a budget revision on a funded proposal', function () {
    Queue::fake();
    [$pi, $proposal] = br_proposal();

    $response = $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/budget-revision", [
            'reason' => str_repeat('a', 25),
            'items' => br_items(),
        ]);

    $response->assertStatus(201)->assertJsonPath('data.status', 'pending');
    expect(BudgetRevisionRequest::where('proposal_id', $proposal->id)->count())->toBe(1);
});

test('a non-owning PI cannot request a budget revision', function () {
    [, $proposal] = br_proposal();
    $outsider = User::factory()->create();
    $outsider->assignRole('staff');

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/budget-revision", [
            'reason' => str_repeat('a', 25),
            'items' => br_items(),
        ])
        ->assertStatus(403);
});

test('a budget revision cannot be requested for a proposal that is not funded or in midterm', function () {
    [$pi, $proposal] = br_proposal(status: 'draft');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/budget-revision", [
            'reason' => str_repeat('a', 25),
            'items' => br_items(),
        ])
        ->assertStatus(422);
});

test('a second budget revision cannot be requested while one is still pending', function () {
    [$pi, $proposal] = br_proposal();
    BudgetRevisionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_total' => 1000,
        'requested_total' => 1500,
        'requested_items' => br_items(),
        'status' => 'pending',
    ]);

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/budget-revision", [
            'reason' => str_repeat('a', 25),
            'items' => br_items(),
        ])
        ->assertStatus(422);
});

test('requesting a revision notifies the category officer', function () {
    Queue::fake();
    [$pi, $proposal] = br_proposal(category: 'research');
    $officer = User::factory()->create();
    $officer->assignRole('research_officer');

    $this->actingAs($pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/budget-revision", [
            'reason' => str_repeat('a', 25),
            'items' => br_items(),
        ])
        ->assertStatus(201);

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $officer->id && $job->event === 'budget_revision_requested');
});

// ─── index() ─────────────────────────────────────────────────────────────────

test('a reviewer cannot list budget revision requests', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->getJson('/api/v1/budget-revisions')
        ->assertStatus(403);
});

test('an officer can list budget revision requests', function () {
    [$pi, $proposal] = br_proposal();
    BudgetRevisionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_total' => 1000,
        'requested_total' => 1500,
        'requested_items' => br_items(),
        'status' => 'pending',
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $response = $this->actingAs($officer, 'sanctum')->getJson('/api/v1/budget-revisions')->assertOk();

    expect(collect($response->json('data.data'))->pluck('proposal_id'))->toContain($proposal->id);
});

// ─── approve() ───────────────────────────────────────────────────────────────

test('an officer can approve a pending budget revision and the budget is replaced', function () {
    Queue::fake();
    [$pi, $proposal] = br_proposal();
    $revision = BudgetRevisionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_total' => 1000,
        'requested_total' => 1500,
        'requested_items' => br_items(1500),
        'status' => 'pending',
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/budget-revisions/{$revision->id}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    expect($revision->fresh()->resolved_by)->toBe($officer->id)
        ->and(ProposalBudget::where('proposal_id', $proposal->id)->sum('amount'))->toEqual(1500.0)
        ->and(ProposalBudget::where('proposal_id', $proposal->id)->count())->toBe(1);

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pi->id && $job->event === 'budget_revision_resolved');
});

test('cannot approve a budget revision that is already resolved', function () {
    [$pi, $proposal] = br_proposal();
    $revision = BudgetRevisionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_total' => 1000,
        'requested_total' => 1500,
        'requested_items' => br_items(),
        'status' => 'approved',
        'resolved_at' => now(),
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/budget-revisions/{$revision->id}/approve")
        ->assertStatus(422);
});

test('a reviewer cannot approve a budget revision', function () {
    [$pi, $proposal] = br_proposal();
    $revision = BudgetRevisionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_total' => 1000,
        'requested_total' => 1500,
        'requested_items' => br_items(),
        'status' => 'pending',
    ]);

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $this->actingAs($reviewer, 'sanctum')
        ->postJson("/api/v1/budget-revisions/{$revision->id}/approve")
        ->assertStatus(403);
});

// ─── reject() ────────────────────────────────────────────────────────────────

test('an officer can reject a pending budget revision with a reason, leaving the budget untouched', function () {
    Queue::fake();
    [$pi, $proposal] = br_proposal();
    $revision = BudgetRevisionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_total' => 1000,
        'requested_total' => 1500,
        'requested_items' => br_items(1500),
        'status' => 'pending',
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/budget-revisions/{$revision->id}/reject", [
            'reason' => 'Insufficient justification provided.',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'denied');

    expect(ProposalBudget::where('proposal_id', $proposal->id)->sum('amount'))->toEqual(1000.0);
    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pi->id && $job->event === 'budget_revision_resolved');
});

test('rejecting a budget revision without a reason is rejected', function () {
    [$pi, $proposal] = br_proposal();
    $revision = BudgetRevisionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_total' => 1000,
        'requested_total' => 1500,
        'requested_items' => br_items(),
        'status' => 'pending',
    ]);

    $officer = User::factory()->create();
    $officer->assignRole('central_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/budget-revisions/{$revision->id}/reject", [])
        ->assertStatus(422);
});

// ─── show() ──────────────────────────────────────────────────────────────────

test('a PI can view their proposal\'s latest budget revision request', function () {
    [$pi, $proposal] = br_proposal();
    BudgetRevisionRequest::create([
        'proposal_id' => $proposal->id,
        'requested_by' => $pi->id,
        'reason' => str_repeat('a', 25),
        'current_total' => 1000,
        'requested_total' => 1500,
        'requested_items' => br_items(),
        'status' => 'pending',
    ]);

    $this->actingAs($pi, 'sanctum')
        ->getJson("/api/v1/proposals/{$proposal->id}/budget-revision")
        ->assertOk()
        ->assertJsonPath('data.status', 'pending');
});
