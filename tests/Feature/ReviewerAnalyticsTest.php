<?php

use App\Models\College;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\Department;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
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

    return compact('admin', 'pi', 'reviewer', 'proposal', 'evalType', 'college', 'dept');
}

function ra_makeAbstractReview(User $admin, User $reviewer, ?int $score = null, bool $submitted = false): ConferenceAbstractReview
{
    $conference = Conference::create([
        'title' => 'RA Conference '.rand(),
        'start_date' => now()->addMonth(),
        'end_date' => now()->addMonth()->addDays(2),
        'status' => 'published',
        'created_by' => $admin->id,
    ]);

    $abstract = ConferenceAbstract::create([
        'conference_id' => $conference->id,
        'submitter_name' => 'Some Presenter',
        'submitter_email' => 'presenter-'.rand(1000, 9999).'@example.com',
        'title' => 'RA Abstract',
        'body' => 'Body text.',
        'status' => 'under_review',
        'submitted_at' => now(),
    ]);

    return ConferenceAbstractReview::create([
        'abstract_id' => $abstract->id,
        'reviewer_id' => $reviewer->id,
        'score' => $score,
        'submitted_at' => $submitted ? now() : null,
    ]);
}

// A fresh proposal for the same PI/college — needed when creating multiple
// assignments for the same reviewer + evaluation type, since (proposal_id,
// reviewer_id, evaluation_type_id) is unique on review_assignments.
function ra_extraProposal(User $admin, User $pi, College $college, Department $dept): Proposal
{
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'RA Extra Call', 'slug' => 'ra-extra-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(2)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'RA-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'RA Extra Proposal',
        'status' => 'under_blind_review',
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);
}

function ra_scoredEvalType(): array
{
    $evalType = EvaluationType::create(['name' => 'blind_review_scored_'.rand(1000, 9999), 'label' => 'Blind Review', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $evalType->id, 'name' => 'Quality', 'order_index' => 1, 'weight' => 100]);
    $question = EvaluationQuestion::create(['evaluation_category_id' => $category->id, 'question_text' => 'Q', 'max_score' => 100, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    return [$evalType, $question];
}

function ra_scoredAssignment(User $admin, User $reviewer, Proposal $proposal, EvaluationType $evalType, EvaluationQuestion $question, int $score, ?string $submittedAt = null): ReviewAssignment
{
    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id, 'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id, 'status' => 'submitted',
        'assigned_at' => now()->subDays(3), 'submitted_at' => $submittedAt ?? now(), 'due_date' => now()->addDay()->toDateString(),
    ]);
    ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $question->id, 'score' => $score]);

    return $assignment;
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

test('reviewer analytics flags external reviewers via their roles', function () {
    ['admin' => $admin, 'proposal' => $proposal, 'evalType' => $evalType] = ra_base();

    $external = User::factory()->create();
    $external->assignRole('external_reviewer');

    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $external->id,
        'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'pending',
        'assigned_at' => now(),
        'due_date' => now()->addDays(7)->toDateString(),
    ]);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics')
        ->assertOk();

    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $external->id);

    expect($entry)->not->toBeNull();
    $roleNames = collect($entry['reviewer']['roles'])->pluck('name');
    expect($roleNames)->toContain('external_reviewer');
});

test('reviewer workload list includes the reviewer role so external reviewers can be flagged', function () {
    ['admin' => $admin, 'proposal' => $proposal, 'evalType' => $evalType] = ra_base();

    $external = User::factory()->create();
    $external->assignRole('external_reviewer');

    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $external->id,
        'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'pending',
        'assigned_at' => now(),
        'due_date' => now()->addDays(7)->toDateString(),
    ]);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-workload')
        ->assertOk();

    $entry = collect($res->json('data'))->firstWhere('reviewer_id', $external->id);

    expect($entry)->not->toBeNull();
    $roleNames = collect($entry['reviewer']['roles'])->pluck('name');
    expect($roleNames)->toContain('external_reviewer');
});

test('reviewer analytics combines proposal and abstract review workload for the same reviewer', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal, 'evalType' => $evalType] = ra_base();

    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'submitted',
        'assigned_at' => now()->subDays(3),
        'submitted_at' => now(),
        'due_date' => now()->addDay()->toDateString(),
    ]);

    ra_makeAbstractReview($admin, $reviewer, score: 8, submitted: true);
    ra_makeAbstractReview($admin, $reviewer, submitted: false);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics')
        ->assertOk();

    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);

    expect($entry['total'])->toBe(1)
        ->and($entry['completed'])->toBe(1)
        ->and($entry['abstract_reviews']['total'])->toBe(2)
        ->and($entry['abstract_reviews']['completed'])->toBe(1)
        ->and($entry['abstract_reviews']['pending'])->toBe(1)
        ->and($entry['abstract_reviews']['avg_score'])->toEqual(8.0)
        ->and($entry['combined_total'])->toBe(3)
        ->and($entry['combined_pending'])->toBe(1)
        ->and($entry['combined_completed'])->toBe(2);
});

test('a reviewer with only abstract assignments still appears with correct combined counts', function () {
    ['admin' => $admin] = ra_base();

    $abstractOnlyReviewer = User::factory()->create();
    $abstractOnlyReviewer->assignRole('staff');

    ra_makeAbstractReview($admin, $abstractOnlyReviewer, submitted: false);
    ra_makeAbstractReview($admin, $abstractOnlyReviewer, submitted: false);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics')
        ->assertOk();

    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $abstractOnlyReviewer->id);

    expect($entry)->not->toBeNull()
        ->and($entry['total'])->toBe(0)
        ->and($entry['abstract_reviews']['total'])->toBe(2)
        ->and($entry['abstract_reviews']['pending'])->toBe(2)
        ->and($entry['combined_total'])->toBe(2)
        ->and($entry['combined_pending'])->toBe(2);

    expect($res->json('data.summary.total_abstract_pending'))->toBeGreaterThanOrEqual(2);
});

test('abstract reviews are excluded when filtering analytics by college, since abstracts have no college', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal, 'evalType' => $evalType, 'college' => $college] = ra_base();

    ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id,
        'status' => 'pending',
        'assigned_at' => now(),
        'due_date' => now()->addDays(7)->toDateString(),
    ]);

    ra_makeAbstractReview($admin, $reviewer, submitted: false);

    $res = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics?college_id='.$college->id)
        ->assertOk();

    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);

    expect($entry['abstract_reviews']['total'])->toBe(0)
        ->and($entry['combined_total'])->toBe($entry['total']);
});

// ─── Authorization & college scoping ────────────────────────────────────────

test('a user without a workload role cannot access reviewer analytics or workload', function () {
    ['pi' => $pi] = ra_base();

    $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics')
        ->assertForbidden();

    $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-workload')
        ->assertForbidden();
});

test('college officer cannot see another college\'s reviewer analytics by spoofing college_id', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposalA, 'evalType' => $evalType, 'college' => $collegeA] = ra_base();

    $collegeB = College::create(['name' => 'RA C B '.rand(), 'code' => 'RB'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RDB'.rand(10, 99)]);
    $piB = User::factory()->create(['college_id' => $collegeB->id, 'department_id' => $deptB->id]);
    $piB->assignRole('pi');
    $callB = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'B Call',
        'slug' => 'rb-call-'.rand(10000, 99999), 'start_date' => now()->toDateString(),
        'end_date' => now()->addMonths(2)->toDateString(), 'status' => 'active',
        'is_open' => true, 'created_by' => $admin->id,
    ]);
    $proposalB = Proposal::create([
        'tracker_number' => 'RB-'.rand(100000, 999999), 'proposal_call_id' => $callB->id,
        'category' => 'research', 'title' => 'B Proposal', 'status' => 'under_blind_review',
        'pi_user_id' => $piB->id, 'college_id' => $collegeB->id, 'department_id' => $deptB->id,
        'academic_year' => '2026', 'created_by' => $piB->id,
    ]);

    $reviewerB = User::factory()->create();
    $reviewerB->assignRole('reviewer');

    ReviewAssignment::create([
        'proposal_id' => $proposalA->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $evalType->id,
        'assigned_by' => $admin->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->addDays(7)->toDateString(),
    ]);
    ReviewAssignment::create([
        'proposal_id' => $proposalB->id, 'reviewer_id' => $reviewerB->id, 'evaluation_type_id' => $evalType->id,
        'assigned_by' => $admin->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->addDays(7)->toDateString(),
    ]);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    // Attempt to view college B's data by passing its id explicitly.
    $analytics = $this->actingAs($officerA, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-analytics?college_id='.$collegeB->id)
        ->assertOk();
    $ids = collect($analytics->json('data.reviewers'))->pluck('reviewer_id');
    expect($ids)->toContain($reviewer->id)->not->toContain($reviewerB->id);

    $workload = $this->actingAs($officerA, 'sanctum')
        ->getJson('/api/v1/admin/reviewer-workload?college_id='.$collegeB->id)
        ->assertOk();
    $reviewerIds = collect($workload->json('data'))->pluck('reviewer_id');
    expect($reviewerIds)->toContain($reviewer->id)->not->toContain($reviewerB->id);
});

// ─── Leniency, risk flag, score distribution ───────────────────────────────────

test('avg_score_pct reflects the weighted percentage, not the raw score', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal] = ra_base();
    [$evalType, $question] = ra_scoredEvalType();
    ra_scoredAssignment($admin, $reviewer, $proposal, $evalType, $question, 80);

    $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/reviewer-analytics')->assertOk();
    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);

    expect($entry['avg_score_pct'])->toEqual(80.0);
});

test('leniency_delta is positive for a reviewer who scores above their peers on the same rubric', function () {
    ['admin' => $admin, 'proposal' => $proposal] = ra_base();
    [$evalType, $question] = ra_scoredEvalType();

    $lenient = User::factory()->create();
    $lenient->assignRole('reviewer');
    $strict = User::factory()->create();
    $strict->assignRole('reviewer');

    ra_scoredAssignment($admin, $lenient, $proposal, $evalType, $question, 95);
    ra_scoredAssignment($admin, $strict, $proposal, $evalType, $question, 40);

    $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/reviewer-analytics')->assertOk();
    $reviewers = collect($res->json('data.reviewers'));
    $lenientEntry = $reviewers->firstWhere('reviewer_id', $lenient->id);
    $strictEntry = $reviewers->firstWhere('reviewer_id', $strict->id);

    expect($lenientEntry['leniency_delta'])->toBeGreaterThan(0)
        ->and($strictEntry['leniency_delta'])->toBeLessThan(0);
});

test('risk_flag is true once a reviewer misses over 30% of deadlines with enough history', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal, 'evalType' => $evalType, 'pi' => $pi, 'college' => $college, 'dept' => $dept] = ra_base();

    $proposals = [$proposal, ra_extraProposal($admin, $pi, $college, $dept), ra_extraProposal($admin, $pi, $college, $dept)];
    foreach ([true, true, false] as $i => $late) {
        ReviewAssignment::create([
            'proposal_id' => $proposals[$i]->id, 'reviewer_id' => $reviewer->id, 'assigned_by' => $admin->id,
            'evaluation_type_id' => $evalType->id, 'status' => 'submitted',
            'assigned_at' => now()->subDays(10),
            'due_date' => now()->subDays(5)->toDateString(),
            'submitted_at' => $late ? now() : now()->subDays(6),
        ]);
    }

    $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/reviewer-analytics')->assertOk();
    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);

    expect($entry['risk_flag'])->toBeTrue();
});

test('risk_flag is true once a reviewer declines over a fifth of their assignments', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal, 'evalType' => $evalType, 'pi' => $pi, 'college' => $college, 'dept' => $dept] = ra_base();

    $proposals = [$proposal, ra_extraProposal($admin, $pi, $college, $dept), ra_extraProposal($admin, $pi, $college, $dept)];
    foreach (['declined', 'pending', 'pending'] as $i => $status) {
        ReviewAssignment::create([
            'proposal_id' => $proposals[$i]->id, 'reviewer_id' => $reviewer->id, 'assigned_by' => $admin->id,
            'evaluation_type_id' => $evalType->id, 'status' => $status,
            'assigned_at' => now(), 'due_date' => now()->addDays(7)->toDateString(),
        ]);
    }

    $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/reviewer-analytics')->assertOk();
    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);

    expect($entry['risk_flag'])->toBeTrue();
});

test('risk_flag stays false without enough history, even if every assignment so far was late', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal, 'evalType' => $evalType] = ra_base();

    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id, 'assigned_by' => $admin->id,
        'evaluation_type_id' => $evalType->id, 'status' => 'submitted',
        'assigned_at' => now()->subDays(10), 'due_date' => now()->subDays(5)->toDateString(), 'submitted_at' => now(),
    ]);

    $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/reviewer-analytics')->assertOk();
    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);

    expect($entry['risk_flag'])->toBeFalse();
});

test('score_distribution buckets a reviewer\'s weighted percentages', function () {
    ['admin' => $admin, 'reviewer' => $reviewer, 'proposal' => $proposal] = ra_base();
    [$evalType, $question] = ra_scoredEvalType();
    ra_scoredAssignment($admin, $reviewer, $proposal, $evalType, $question, 90);

    $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/reviewer-analytics')->assertOk();
    $entry = collect($res->json('data.reviewers'))->firstWhere('reviewer_id', $reviewer->id);

    expect($entry['score_distribution']['80-100'])->toBe(1)
        ->and($entry['score_distribution']['0-19'])->toBe(0);
});
