<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewReminder;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function rd_makeBase(): array
{
    $college = College::create(['name' => 'RD College '.rand(), 'code' => 'RD'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RDD'.rand(10000, 99999)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'RD Call', 'slug' => 'rd-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return [$college, $dept, $central, $call];
}

function rd_assignment(College $college, Department $dept, ProposalCall $call, string $dueDate, string $status = 'pending', ?User $reviewer = null): ReviewAssignment
{
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer ??= User::factory()->create(['name' => 'Reviewer '.rand()]);
    if (! $reviewer->hasRole('reviewer')) {
        $reviewer->assignRole('reviewer');
    }

    $proposal = Proposal::create([
        'tracker_number' => 'RD-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'RD Proposal', 'status' => 'under_blind_review',
        'pi_user_id' => $reviewer->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $admin->id,
    ]);
    $type = EvaluationType::create([
        'name' => 'blind_review_rd_'.rand(1000, 9999),
        'label' => 'Blind Review', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    return ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by' => $admin->id,
        'status' => $status,
        'assigned_at' => now(),
        'due_date' => $dueDate,
    ]);
}

test('unauthenticated user cannot access the review deadlines dashboard', function () {
    $this->getJson('/api/v1/admin/review-deadlines')->assertUnauthorized();
});

test('a non-admin role cannot access the review deadlines dashboard', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    $officer = User::factory()->create();
    $officer->assignRole('research_officer');

    $this->actingAs($officer, 'sanctum')
        ->getJson('/api/v1/admin/review-deadlines')
        ->assertForbidden();
});

test('lists overdue and upcoming assignments with correct counts', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    rd_assignment($college, $dept, $call, now()->subDays(5)->toDateString());
    rd_assignment($college, $dept, $call, now()->toDateString());
    rd_assignment($college, $dept, $call, now()->addDays(3)->toDateString());
    rd_assignment($college, $dept, $call, now()->addDays(20)->toDateString());

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/review-deadlines');

    $response->assertOk();
    expect($response->json('data.assignments.total'))->toBe(4)
        ->and($response->json('data.counts.overdue'))->toBe(1)
        ->and($response->json('data.counts.due_today'))->toBe(1)
        ->and($response->json('data.counts.due_this_week'))->toBe(1);
});

test('the status filter narrows the list to overdue only', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    rd_assignment($college, $dept, $call, now()->subDays(2)->toDateString());
    rd_assignment($college, $dept, $call, now()->addDays(5)->toDateString());

    $response = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/admin/review-deadlines?status=overdue');

    $response->assertOk();
    expect($response->json('data.assignments.total'))->toBe(1);
});

test('submitted and declined assignments never appear on the dashboard', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    rd_assignment($college, $dept, $call, now()->subDays(1)->toDateString(), 'submitted');
    rd_assignment($college, $dept, $call, now()->subDays(1)->toDateString(), 'declined');
    rd_assignment($college, $dept, $call, now()->subDays(1)->toDateString(), 'pending');

    $response = $this->actingAs($central, 'sanctum')->getJson('/api/v1/admin/review-deadlines');

    $response->assertOk();
    expect($response->json('data.assignments.total'))->toBe(1);
});

test('sorting by reviewer name joins the users table correctly', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    $zoe = User::factory()->create(['name' => 'Zoe Zimmerman']);
    $aaron = User::factory()->create(['name' => 'Aaron Adams']);
    rd_assignment($college, $dept, $call, now()->addDays(1)->toDateString(), 'pending', $zoe);
    rd_assignment($college, $dept, $call, now()->addDays(2)->toDateString(), 'pending', $aaron);

    $response = $this->actingAs($central, 'sanctum')
        ->getJson('/api/v1/admin/review-deadlines?sort=reviewer&direction=asc');

    $response->assertOk();
    $names = collect($response->json('data.assignments.data'))->pluck('reviewer.name')->all();
    expect($names)->toBe(['Aaron Adams', 'Zoe Zimmerman']);
});

test('an admin can manually remind a reviewer and it is logged in the reminder history', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    $assignment = rd_assignment($college, $dept, $call, now()->addDays(2)->toDateString());

    $response = $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/remind");

    $response->assertOk();
    expect(ReviewReminder::where('review_assignment_id', $assignment->id)->where('type', 'manual')->where('sent_by', $central->id)->exists())->toBeTrue();
});

test('a manual reminder email carries the real proposal title and tracker number, not blanks', function () {
    // Regression: remind()/bulkRemind() eager-load the proposal with only id/college_id
    // (enough for the scope check) — ReviewReminderService must not trust that narrow
    // relation for tracker_number/title, or the email renders them empty.
    Bus::fake([SendEmailNotificationJob::class]);

    [$college, $dept, $central, $call] = rd_makeBase();
    $assignment = rd_assignment($college, $dept, $call, now()->addDays(2)->toDateString());
    $proposal = $assignment->proposal;

    $this->actingAs($central, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/remind")
        ->assertOk();

    Bus::assertDispatched(SendEmailNotificationJob::class, function ($job) use ($proposal) {
        return $job->data['tracker_number'] === $proposal->tracker_number
            && $job->data['proposal_title'] === $proposal->title;
    });
});

test('a second manual remind within the cooldown window is rejected', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    $assignment = rd_assignment($college, $dept, $call, now()->addDays(2)->toDateString());

    $this->actingAs($central, 'sanctum')->postJson("/api/v1/review-assignments/{$assignment->id}/remind")->assertOk();
    $this->actingAs($central, 'sanctum')->postJson("/api/v1/review-assignments/{$assignment->id}/remind")->assertStatus(422);

    expect(ReviewReminder::where('review_assignment_id', $assignment->id)->count())->toBe(1);
});

test('a non-admin cannot send a manual reminder', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    $assignment = rd_assignment($college, $dept, $call, now()->addDays(2)->toDateString());
    $officer = User::factory()->create();
    $officer->assignRole('research_officer');

    $this->actingAs($officer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/remind")
        ->assertForbidden();
});

test('a college officer only sees assignments from their own college', function () {
    [$collegeA, $deptA, $central, $callA] = rd_makeBase();
    $collegeB = College::create(['name' => 'RD College B '.rand(), 'code' => 'RB'.rand(10000, 99999)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RBD'.rand(10000, 99999)]);

    rd_assignment($collegeA, $deptA, $callA, now()->addDays(1)->toDateString());
    rd_assignment($collegeB, $deptB, $callA, now()->addDays(1)->toDateString());
    rd_assignment($collegeB, $deptB, $callA, now()->addDays(1)->toDateString());

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/admin/review-deadlines');

    $response->assertOk();
    expect($response->json('data.assignments.total'))->toBe(1)
        ->and($response->json('data.colleges'))->toHaveCount(1);
});

test('a college officer cannot remind a reviewer outside their college', function () {
    [$collegeA, $deptA, $central, $callA] = rd_makeBase();
    $collegeB = College::create(['name' => 'RD College C '.rand(), 'code' => 'RC'.rand(10000, 99999)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RCD'.rand(10000, 99999)]);
    $assignment = rd_assignment($collegeB, $deptB, $callA, now()->addDays(1)->toDateString());

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $this->actingAs($officerA, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/remind")
        ->assertForbidden();

    expect(ReviewReminder::where('review_assignment_id', $assignment->id)->exists())->toBeFalse();
});

test('bulk remind sends a reminder for every valid id and reports the summary', function () {
    [$college, $dept, $central, $call] = rd_makeBase();
    $a1 = rd_assignment($college, $dept, $call, now()->addDays(1)->toDateString());
    $a2 = rd_assignment($college, $dept, $call, now()->addDays(2)->toDateString());

    $response = $this->actingAs($central, 'sanctum')
        ->postJson('/api/v1/review-assignments/bulk-remind', ['ids' => [$a1->id, $a2->id]]);

    $response->assertOk();
    expect($response->json('data.sent'))->toBe(2)
        ->and(ReviewReminder::where('review_assignment_id', $a1->id)->where('type', 'manual')->exists())->toBeTrue()
        ->and(ReviewReminder::where('review_assignment_id', $a2->id)->where('type', 'manual')->exists())->toBeTrue();
});

test('bulk remind reports out-of-scope items separately for a college officer without aborting the batch', function () {
    [$collegeA, $deptA, $central, $callA] = rd_makeBase();
    $collegeB = College::create(['name' => 'RD College D '.rand(), 'code' => 'RE'.rand(10000, 99999)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RED'.rand(10000, 99999)]);

    $inScope = rd_assignment($collegeA, $deptA, $callA, now()->addDays(1)->toDateString());
    $outOfScope = rd_assignment($collegeB, $deptB, $callA, now()->addDays(1)->toDateString());

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')
        ->postJson('/api/v1/review-assignments/bulk-remind', ['ids' => [$inScope->id, $outOfScope->id]]);

    $response->assertOk();
    expect($response->json('data.sent'))->toBe(1)
        ->and($response->json('data.out_of_scope'))->toBe(1)
        ->and(ReviewReminder::where('review_assignment_id', $inScope->id)->exists())->toBeTrue()
        ->and(ReviewReminder::where('review_assignment_id', $outOfScope->id)->exists())->toBeFalse();
});

test('bulk remind requires a non-empty ids array', function () {
    [$college, $dept, $central, $call] = rd_makeBase();

    $this->actingAs($central, 'sanctum')
        ->postJson('/api/v1/review-assignments/bulk-remind', ['ids' => []])
        ->assertStatus(422);
});
