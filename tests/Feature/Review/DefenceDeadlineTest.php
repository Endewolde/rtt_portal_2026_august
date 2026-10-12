<?php

use App\Exceptions\DefenceScoringClosedException;
use App\Models\College;
use App\Models\DefenceDeadlineExtension;
use App\Models\DefenceSession;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Services\ReviewScoreService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();

    $this->college = College::create(['name' => 'College of Science', 'code' => 'CS'.rand(10, 99)]);
    $this->department = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'DD'.rand(10, 99)]);

    $this->collegeOfficer = User::factory()->create(['college_id' => $this->college->id]);
    $this->collegeOfficer->assignRole('college_officer');

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');

    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'dd-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
});

function dd_proposal(object $ctx, string $category = 'research'): Proposal
{
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    return Proposal::create([
        'tracker_number' => 'DD-'.rand(100000, 999999),
        'proposal_call_id' => $ctx->call->id, 'category' => $category,
        'title' => 'P '.rand(), 'status' => 'under_open_defence',
        'pi_user_id' => $pi->id, 'college_id' => $ctx->college->id,
        'department_id' => $ctx->department->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

function dd_session(object $ctx, Proposal $proposal, string $date, array $attrs = []): DefenceSession
{
    return DefenceSession::create(array_merge([
        'proposal_id' => $proposal->id, 'scheduled_date' => $date, 'scheduled_time' => '10:00',
        'venue' => 'Hall', 'status' => 'scheduled', 'scheduled_by' => $ctx->collegeOfficer->id,
    ], $attrs));
}

function dd_assignment(Proposal $proposal, User $assignedBy, string $status = 'pending'): ReviewAssignment
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = EvaluationType::firstOrCreate(
        ['name' => 'open_defence_dd'],
        ['label' => 'Open Defence', 'proposal_category' => 'research', 'is_active' => true]
    );

    return ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $assignedBy->id,
        'status' => $status, 'assigned_at' => now(),
    ]);
}

function dd_extension(object $ctx, DefenceSession $session, array $attrs = []): DefenceDeadlineExtension
{
    return DefenceDeadlineExtension::create(array_merge([
        'defence_session_id' => $session->id, 'proposal_id' => $session->proposal_id,
        'requested_by' => $ctx->collegeOfficer->id, 'requested_until' => now()->addDays(2),
        'reason' => 'Two reviewers were travelling.', 'status' => 'pending',
    ], $attrs));
}

// ─── The deadline ────────────────────────────────────────────────────────────

test('a Monday defence is due by the end of Tuesday', function () {
    $session = dd_session($this, dd_proposal($this), '2026-10-12');

    expect($session->scoreDeadline()->toDateTimeString())->toBe('2026-10-13 23:59:59');
});

test('scores are accepted on the defence day and the day after', function () {
    $proposal = dd_proposal($this);
    $assignment = dd_assignment($proposal, $this->central);
    dd_session($this, $proposal, '2026-10-12');
    $method = new ReflectionMethod(ReviewScoreService::class, 'assertDefenceDateWindow');

    foreach (['2026-10-12 09:00', '2026-10-13 23:30'] as $moment) {
        Carbon::setTestNow($moment);
        expect(fn () => $method->invoke(app(ReviewScoreService::class), $assignment))->not->toThrow(DefenceScoringClosedException::class);
    }

    Carbon::setTestNow('2026-10-11 18:00');
    expect(fn () => $method->invoke(app(ReviewScoreService::class), $assignment))
        ->toThrow(DefenceScoringClosedException::class, 'The open defence session has not started yet.');

    Carbon::setTestNow();
});

test('a late reviewer gets the closed-submission message as a 422', function () {
    $proposal = dd_proposal($this);
    $assignment = dd_assignment($proposal, $this->central);
    dd_session($this, $proposal, '2026-10-12');
    Carbon::setTestNow('2026-10-14 08:00');

    $this->actingAs(User::find($assignment->reviewer_id), 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/score", ['answers' => [['question_id' => 'any', 'score' => 1]]])
        ->assertStatus(422)
        ->assertJsonPath('message', 'You cannot submit right now. Result submission must be done in the assigned defence room during the presentation period, or by the due date (one day after the defence). For more information, please contact your college officer.');

    Carbon::setTestNow();
});

test('an approved extension lets late reviewers submit again', function () {
    $proposal = dd_proposal($this);
    $assignment = dd_assignment($proposal, $this->central);
    dd_session($this, $proposal, '2026-10-12', ['score_deadline_extended_until' => '2026-10-16 23:59:00']);
    Carbon::setTestNow('2026-10-15 10:00');

    $method = new ReflectionMethod(ReviewScoreService::class, 'assertDefenceDateWindow');
    expect(fn () => $method->invoke(app(ReviewScoreService::class), $assignment))->not->toThrow(DefenceScoringClosedException::class);

    Carbon::setTestNow();
});

test('scheduling a defence sets reviewers\' due date to the day after the defence', function () {
    $proposal = dd_proposal($this);
    $proposal->update(['status' => 'blind_review_passed']);
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $type = EvaluationType::create(['name' => 'open_defence_sched', 'label' => 'OD', 'proposal_category' => 'research', 'is_active' => true]);
    $date = now()->addDays(3)->toDateString();

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/defence/schedule", [
            'scheduled_date' => $date, 'scheduled_time' => '10:00', 'venue' => 'Hall',
            'reviewer_ids' => [$reviewer->id], 'evaluation_type_id' => $type->id,
        ])
        ->assertCreated();

    expect(ReviewAssignment::where('reviewer_id', $reviewer->id)->first()->due_date->toDateString())
        ->toBe(Carbon::parse($date)->addDay()->toDateString());
});

// ─── Requesting an extension ─────────────────────────────────────────────────

test('the college officer requests an extension and the category director and central office are notified', function () {
    $proposal = dd_proposal($this, 'research');
    $session = dd_session($this, $proposal, now()->subDays(3)->toDateString());
    $researchDirector = User::factory()->create();
    $researchDirector->assignRole('research_officer');
    $communityDirector = User::factory()->create();
    $communityDirector->assignRole('community_officer');

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->postJson("/api/v1/defence-sessions/{$session->id}/deadline-extensions", [
            'requested_until' => now()->addDays(10)->toDateTimeString(),
            'reason' => 'Two reviewers were at a conference.',
        ])
        ->assertCreated()
        ->assertJsonPath('data.pending_extension.status', 'pending');

    $notified = fn (User $u) => DB::table('notifications')->where('notifiable_id', $u->id)->where('type', 'defence_extension_requested')->exists();
    expect($notified($researchDirector))->toBeTrue()
        ->and($notified($this->central))->toBeTrue()
        ->and($notified($communityDirector))->toBeFalse();
});

test('there is no limit on how far or how late an extension can be requested', function () {
    $session = dd_session($this, dd_proposal($this), now()->subDays(60)->toDateString());

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->postJson("/api/v1/defence-sessions/{$session->id}/deadline-extensions", [
            'requested_until' => now()->addDays(45)->toDateTimeString(),
            'reason' => 'The panel could not reconvene earlier.',
        ])
        ->assertCreated();
});

test('only one pending request per defence, and the new date must be later and in the future', function () {
    $session = dd_session($this, dd_proposal($this), now()->subDays(3)->toDateString());
    $request = fn (string $until) => $this->actingAs($this->collegeOfficer, 'sanctum')
        ->postJson("/api/v1/defence-sessions/{$session->id}/deadline-extensions", ['requested_until' => $until, 'reason' => 'Reviewers need more time.']);

    $request(now()->subHour()->toDateTimeString())->assertStatus(422);
    $request(now()->addDays(2)->toDateTimeString())->assertCreated();
    $request(now()->addDays(3)->toDateTimeString())
        ->assertStatus(422)
        ->assertJsonPath('message', 'An extension request for this defence is already awaiting approval.');
});

test('only the proposal\'s own college officer can request an extension', function () {
    $session = dd_session($this, dd_proposal($this), now()->subDays(3)->toDateString());
    $otherCollege = College::create(['name' => 'Other', 'code' => 'OT'.rand(10, 99)]);
    $otherOfficer = User::factory()->create(['college_id' => $otherCollege->id]);
    $otherOfficer->assignRole('college_officer');

    foreach ([$otherOfficer, $this->central] as $user) {
        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/defence-sessions/{$session->id}/deadline-extensions", ['requested_until' => now()->addDays(2)->toDateTimeString(), 'reason' => 'Reviewers need more time.'])
            ->assertForbidden();
    }
});

// ─── Approval ────────────────────────────────────────────────────────────────

test('the proposal\'s category director approves, reopening scoring for its reviewers', function () {
    $proposal = dd_proposal($this, 'community_engagement');
    $assignment = dd_assignment($proposal, $this->central);
    $session = dd_session($this, $proposal, now()->subDays(4)->toDateString(), ['flagged_incomplete_at' => now()]);
    $extension = dd_extension($this, $session);
    $director = User::factory()->create();
    $director->assignRole('community_officer');
    $grantedUntil = now()->addDays(3)->setTime(17, 0);

    $this->actingAs($director, 'sanctum')
        ->postJson("/api/v1/defence-deadline-extensions/{$extension->id}/decide", [
            'decision' => 'approved', 'granted_until' => $grantedUntil->toDateTimeString(), 'notes' => 'Approved — please finish by Friday.',
        ])
        ->assertOk();

    $session->refresh();
    expect($session->scoreDeadline()->toDateTimeString())->toBe($grantedUntil->toDateTimeString())
        ->and($session->flagged_incomplete_at)->toBeNull()
        ->and($assignment->fresh()->due_date->toDateString())->toBe($grantedUntil->toDateString())
        ->and(DB::table('notifications')->where('notifiable_id', $assignment->reviewer_id)->where('type', 'defence_deadline_extended')->exists())->toBeTrue()
        ->and(DB::table('notifications')->where('notifiable_id', $this->collegeOfficer->id)->where('type', 'defence_extension_resolved')->exists())->toBeTrue();
});

test('a director from another category cannot decide, but admin and central officer can', function () {
    $session = dd_session($this, dd_proposal($this, 'research'), now()->subDays(3)->toDateString());
    $extension = dd_extension($this, $session);
    $techDirector = User::factory()->create();
    $techDirector->assignRole('technology_officer');

    $this->actingAs($techDirector, 'sanctum')
        ->postJson("/api/v1/defence-deadline-extensions/{$extension->id}/decide", ['decision' => 'approved', 'notes' => 'Fine by me.'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the Research Director or the central office can decide this extension request.');

    $this->actingAs($techDirector, 'sanctum')
        ->getJson('/api/v1/defence-deadline-extensions?status=pending')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/defence-deadline-extensions/{$extension->id}/decide", ['decision' => 'denied', 'notes' => 'Not justified.'])
        ->assertOk();

    expect($extension->fresh()->status)->toBe('denied')
        ->and($session->fresh()->score_deadline_extended_until)->toBeNull();
});

test('a college officer cannot approve their own request', function () {
    $extension = dd_extension($this, dd_session($this, dd_proposal($this), now()->subDays(3)->toDateString()));

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->postJson("/api/v1/defence-deadline-extensions/{$extension->id}/decide", ['decision' => 'approved', 'notes' => 'Self approval.'])
        ->assertForbidden();
});

// ─── Reminders & flagging ────────────────────────────────────────────────────

test('the sweep reminds outstanding reviewers once on the last day', function () {
    $proposal = dd_proposal($this);
    $assignment = dd_assignment($proposal, $this->central);
    dd_session($this, $proposal, '2026-10-12');
    Carbon::setTestNow('2026-10-13 08:00');

    Artisan::call('rtt:defence-deadlines');
    Artisan::call('rtt:defence-deadlines');

    expect(DB::table('notifications')->where('notifiable_id', $assignment->reviewer_id)->where('type', 'defence_deadline_reminder')->count())->toBe(1);
    Carbon::setTestNow();
});

test('the sweep flags a defence past its deadline and tells the college officer, without rejecting it', function () {
    $proposal = dd_proposal($this);
    dd_assignment($proposal, $this->central);
    $session = dd_session($this, $proposal, '2026-10-12');
    Carbon::setTestNow('2026-10-14 09:00');

    Artisan::call('rtt:defence-deadlines');

    expect($session->fresh()->flagged_incomplete_at)->not->toBeNull()
        ->and($proposal->fresh()->status)->toBe('under_open_defence')
        ->and(DB::table('notifications')->where('notifiable_id', $this->collegeOfficer->id)->where('type', 'defence_deadline_passed')->count())->toBe(1);
    Carbon::setTestNow();
});

test('the Open Defence list carries each proposal\'s deadline and extension state', function () {
    $proposal = dd_proposal($this);
    dd_assignment($proposal, $this->central);
    dd_session($this, $proposal, now()->subDays(3)->toDateString());

    $this->actingAs($this->collegeOfficer, 'sanctum')
        ->getJson('/api/v1/admin/review-management?status=blind_review_passed,under_open_defence')
        ->assertOk()
        ->assertJsonPath('data.0.defence_deadline.phase', 'passed')
        ->assertJsonPath('data.0.defence_deadline.outstanding_scores', 1)
        ->assertJsonPath('data.0.defence_deadline.can_request_extension', true);
});
