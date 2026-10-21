<?php

use App\Models\College;
use App\Models\DefenceSession;
use App\Models\Department;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();
    DB::table('threshold_settings')->where('key', 'combined_threshold')->update(['value' => 120]);

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');

    $this->college = College::create(['name' => 'C'.rand(), 'code' => 'DA'.rand(10000, 99999)]);
    $this->officer = User::factory()->create(['college_id' => $this->college->id]);
    $this->officer->assignRole('college_officer');

    $this->pi = User::factory()->create(['college_id' => $this->college->id]);
    $this->pi->assignRole('staff');

    $dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'DAD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'da-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->proposal = Proposal::create([
        'tracker_number' => 'DA-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_open_defence', 'pi_user_id' => $this->pi->id, 'college_id' => $this->college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $this->pi->id,
    ]);
    ProposalMember::create(['proposal_id' => $this->proposal->id, 'user_id' => $this->pi->id, 'role' => 'pi', 'status' => 'active', 'joined_at' => now()]);

    $blind = EvaluationType::create(['name' => 'blind_review_da_'.rand(100, 999), 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    da_assignment($this->proposal, $blind, $this->central, 'submitted', 4);

    $this->defenceType = EvaluationType::create(['name' => 'open_defence_da_'.rand(100, 999), 'label' => 'Defence', 'proposal_category' => 'research', 'is_active' => true]);
    $this->session = DefenceSession::create([
        'proposal_id' => $this->proposal->id, 'scheduled_date' => now()->toDateString(), 'scheduled_time' => '10:00:00',
        'venue' => 'Hall', 'status' => 'scheduled', 'scheduled_by' => $this->officer->id,
    ]);
});

/** A review assignment, scored 0–5 on two questions when submitted. */
function da_assignment(Proposal $proposal, EvaluationType $type, User $assignedBy, string $status, int $score = 4): ReviewAssignment
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    acceptReviewerAgreement($reviewer);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $assignedBy->id, 'status' => $status, 'assigned_at' => now(),
        'submitted_at' => $status === 'submitted' ? now() : null,
    ]);

    $category = EvaluationCategory::firstOrCreate(['evaluation_type_id' => $type->id, 'name' => 'Cat'], ['order_index' => 1, 'weight' => 100]);
    foreach ([1, 2] as $i) {
        $question = EvaluationQuestion::firstOrCreate(
            ['evaluation_category_id' => $category->id, 'question_text' => "Q{$i}"],
            ['max_score' => 5, 'weight' => 1, 'is_required' => true, 'order_index' => $i]
        );
        if ($status === 'submitted') {
            ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $question->id, 'score' => $score]);
        }
    }

    return $assignment;
}

function da_submit(ReviewAssignment $assignment, int $score = 4)
{
    $questions = EvaluationQuestion::whereHas('category', fn ($q) => $q->where('evaluation_type_id', $assignment->evaluation_type_id))->get();

    return test()->actingAs($assignment->reviewer, 'sanctum')->postJson("/api/v1/review-assignments/{$assignment->id}/score", [
        'answers' => $questions->map(fn ($q) => ['question_id' => $q->id, 'score' => $score])->all(),
    ]);
}

function da_mark(object $ctx, string $attendance, ?string $note = null, ?User $as = null)
{
    return test()->actingAs($as ?? $ctx->officer, 'sanctum')->postJson("/api/v1/defence-sessions/{$ctx->session->id}/attendance", array_filter([
        'attendance' => $attendance, 'note' => $note,
    ]));
}

// ─── The result waits for the defence to be confirmed ────────────────────────

test('the result is not decided when every score is in until the defence is recorded as held', function () {
    $assignment = da_assignment($this->proposal, $this->defenceType, $this->officer, 'pending');

    da_submit($assignment)->assertOk();

    expect($this->proposal->fresh()->status)->toBe('under_open_defence')
        ->and($this->session->fresh()->attendance_requested_at)->not->toBeNull()
        ->and(DB::table('notifications')->where('notifiable_id', $this->officer->id)->where('type', 'defence_attendance_needed')->exists())->toBeTrue();

    da_mark($this, 'held')->assertOk();

    expect($this->proposal->fresh()->status)->toBe('accepted')
        ->and($this->session->fresh()->attendance)->toBe('held');
});

test('once held, the last score decides the result as before', function () {
    $first = da_assignment($this->proposal, $this->defenceType, $this->officer, 'submitted');
    $second = da_assignment($this->proposal, $this->defenceType, $this->officer, 'pending');

    da_mark($this, 'held')->assertOk()->assertJsonPath('data.proposal_status', 'under_open_defence');
    da_submit($second)->assertOk();

    expect($this->proposal->fresh()->status)->toBe('accepted');
});

test('the manual "process result" also needs the defence recorded as held', function () {
    da_assignment($this->proposal, $this->defenceType, $this->officer, 'submitted');

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/defence/process-result")
        ->assertUnprocessable();

    expect($this->proposal->fresh()->status)->toBe('under_open_defence');
});

// ─── The team did not appear ─────────────────────────────────────────────────

test('recording that the team did not appear rejects the proposal, voids submitted scores and stands the panel down', function () {
    $scored = da_assignment($this->proposal, $this->defenceType, $this->officer, 'submitted');
    $waiting = da_assignment($this->proposal, $this->defenceType, $this->officer, 'pending');

    da_mark($this, 'absent', 'No team member came; the PI did not answer two calls.')->assertOk()
        ->assertJsonPath('data.proposal_status', 'rejected');

    $proposal = $this->proposal->fresh();
    expect($proposal->status)->toBe('rejected')
        ->and($proposal->rejection_reason)->toContain('did not appear for the open defence')
        ->and($proposal->rejection_reason)->toContain('the PI did not answer two calls')
        ->and($scored->fresh()->status)->toBe('voided')
        ->and($waiting->fresh()->status)->toBe('cancelled')
        ->and($this->session->fresh()->status)->toBe('no_show')
        ->and($this->session->fresh()->attendance)->toBe('absent');

    $log = DB::table('workflow_logs')->where('proposal_id', $proposal->id)->where('action', 'fail_defence')->first();
    expect(json_decode($log->metadata, true))->toMatchArray(['no_show' => true, 'automatic' => true, 'recorded_by' => $this->officer->id]);

    $piNotice = DB::table('notifications')->where('notifiable_id', $this->pi->id)->where('type', 'decision_result')->latest('created_at')->first();
    expect(json_decode($piNotice->data, true)['reason'])->toContain('did not appear');

    expect(DB::table('notifications')->where('notifiable_id', $scored->reviewer_id)->where('type', 'defence_score_voided')->exists())->toBeTrue()
        ->and(DB::table('notifications')->where('notifiable_id', $waiting->reviewer_id)->where('type', 'review_assignment_cancelled')->exists())->toBeTrue();
});

test('even with every score in, an absent team is rejected rather than passed', function () {
    da_assignment($this->proposal, $this->defenceType, $this->officer, 'submitted', 5);

    da_mark($this, 'absent', 'The team did not come to the hall.')->assertOk();

    expect($this->proposal->fresh()->status)->toBe('rejected');
});

test('recording an absence needs a note', function () {
    da_mark($this, 'absent')->assertUnprocessable()->assertJsonValidationErrors('note');

    expect($this->proposal->fresh()->status)->toBe('under_open_defence');
});

test('attendance cannot be recorded before the defence date', function () {
    $this->session->update(['scheduled_date' => now()->addDays(3)->toDateString()]);

    da_mark($this, 'absent', 'Trying to record it too early.')->assertUnprocessable();

    expect($this->proposal->fresh()->status)->toBe('under_open_defence');
});

test('attendance can only be recorded once', function () {
    da_assignment($this->proposal, $this->defenceType, $this->officer, 'pending');
    da_mark($this, 'held')->assertOk();

    da_mark($this, 'absent', 'Changed my mind about this defence.')->assertUnprocessable();
});

test('only the college officer of that college records attendance', function () {
    $otherCollege = College::create(['name' => 'O'.rand(), 'code' => 'DO'.rand(10000, 99999)]);
    $otherOfficer = User::factory()->create(['college_id' => $otherCollege->id]);
    $otherOfficer->assignRole('college_officer');
    $director = User::factory()->create();
    $director->assignRole('research_officer');

    da_mark($this, 'absent', 'The team did not come to the hall.', $otherOfficer)->assertForbidden();
    da_mark($this, 'absent', 'The team did not come to the hall.', $director)->assertForbidden();

    expect($this->proposal->fresh()->status)->toBe('under_open_defence');
});

// ─── A panel member flags a no-show ──────────────────────────────────────────

test('a panel member can report that the team did not appear, and the college officer is asked to confirm', function () {
    $assignment = da_assignment($this->proposal, $this->defenceType, $this->officer, 'pending');

    $this->actingAs($assignment->reviewer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/report-absence", ['note' => 'Nobody from the team was in the hall.'])
        ->assertOk();

    expect($this->session->fresh()->absence_reported_by)->toBe($assignment->reviewer_id)
        ->and($this->proposal->fresh()->status)->toBe('under_open_defence')
        ->and(DB::table('notifications')->where('notifiable_id', $this->officer->id)->where('type', 'defence_absence_reported')->exists())->toBeTrue();

    // The Open Defence page shows the report and lets the officer record attendance.
    $row = collect($this->actingAs($this->officer, 'sanctum')->getJson('/api/v1/admin/review-management?status=under_open_defence')->assertOk()->json('data'))
        ->firstWhere('id', $this->proposal->id);
    expect($row['defence_deadline']['absence_reported']['note'])->toBe('Nobody from the team was in the hall.')
        ->and($row['defence_deadline']['can_mark_attendance'])->toBeTrue();
});

test('someone not on the panel cannot report an absence', function () {
    $assignment = da_assignment($this->proposal, $this->defenceType, $this->officer, 'pending');

    $this->actingAs($this->officer, 'sanctum')
        ->postJson("/api/v1/review-assignments/{$assignment->id}/report-absence")
        ->assertForbidden();
});

// ─── Rescheduling ────────────────────────────────────────────────────────────

test('moving the defence to a new date sends submitted scores back to the panel', function () {
    $scored = da_assignment($this->proposal, $this->defenceType, $this->officer, 'submitted');
    da_assignment($this->proposal, $this->defenceType, $this->officer, 'pending');

    $this->actingAs($this->officer, 'sanctum')->putJson("/api/v1/proposals/{$this->proposal->id}/defence/session", [
        'scheduled_date' => now()->addWeek()->toDateString(), 'scheduled_time' => '10:00', 'venue' => 'Hall',
    ])->assertOk();

    expect($scored->fresh()->status)->toBe('pending')
        ->and($scored->fresh()->submitted_at)->toBeNull();
});

test('a defence recorded as held cannot be moved to another date', function () {
    da_assignment($this->proposal, $this->defenceType, $this->officer, 'pending');
    da_mark($this, 'held')->assertOk();

    $this->actingAs($this->officer, 'sanctum')->putJson("/api/v1/proposals/{$this->proposal->id}/defence/session", [
        'scheduled_date' => now()->addWeek()->toDateString(), 'scheduled_time' => '10:00', 'venue' => 'Hall',
    ])->assertUnprocessable();
});
