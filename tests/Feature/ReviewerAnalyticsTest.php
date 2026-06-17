<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ra_base(): array
{
    $college = College::create(['name' => 'RA C '.rand(), 'code' => 'RA'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RD'.rand(10, 99)]);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'RA Call', 'slug' => 'ra-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(2)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'RA-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'RA Proposal',
        'status' => 'under_blind_review',
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);

    $evalType = EvaluationType::create(['name' => 'blind_review', 'label' => 'Blind Review', 'is_active' => true]);

    return compact('admin', 'pi', 'reviewer', 'proposal', 'evalType', 'college');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('unauthenticated user cannot access reviewer analytics', function () {
    $this->getJson('/api/v1/admin/reviewer-analytics')->assertUnauthorized();
});

test('authenticated admin gets analytics structure', function () {
    ['admin' => $admin] = ra_base();

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics')
        ->assertOk();

    $res->assertJsonStructure([
        'data' => [
            'summary' => ['total_reviewers', 'avg_completion_rate', 'total_overdue', 'avg_days_to_complete'],
            'reviewers',
        ],
    ]);
});

test('completed assignments are counted correctly', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal, 'evalType' => $evalType] = ra_base();

    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'submitted',
        'assigned_at' => now()->subDays(5),
        'submitted_at' => now(),
        'due_date' => now()->addDay()->toDateString(),
    ]);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics')
        ->assertOk();

    $reviewers = $res->json('data.reviewers');
    $entry = collect($reviewers)->firstWhere('reviewer_id', $reviewer->id);

    expect($entry)->not->toBeNull()
        ->and($entry['total'])->toBe(1)
        ->and($entry['completed'])->toBe(1)
        ->and($entry['pending'])->toBe(0);
});

test('overdue assignments are identified correctly', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal, 'evalType' => $evalType] = ra_base();

    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'pending',
        'assigned_at' => now()->subDays(10),
        'due_date' => now()->subDays(2)->toDateString(),
    ]);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics')
        ->assertOk();

    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);

    expect($entry['overdue'])->toBe(1)
        ->and($res->json('data.summary.total_overdue'))->toBeGreaterThanOrEqual(1);
});

test('on time rate is 100 when submitted before due date', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal, 'evalType' => $evalType] = ra_base();

    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'submitted',
        'assigned_at' => now()->subDays(5),
        'submitted_at' => now()->subDay(),
        'due_date' => now()->addDay()->toDateString(),
    ]);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics')
        ->assertOk();

    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);
    expect($entry['on_time_rate'])->toBe(100);
});
