<?php

use App\Models\AppSetting;
use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\ThresholdSetting;
use App\Models\User;
use App\Services\ReviewScoreService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 40]); // out of 80

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $college = College::create(['name' => 'C'.rand(), 'code' => 'RD'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RDD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'rd-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $pi = User::factory()->create();
    $pi->assignRole('staff');
    $this->proposal = Proposal::create([
        'tracker_number' => 'RD-1', 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'P',
        'status' => 'under_blind_review', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $this->type = EvaluationType::create(['name' => 'blind_review_rd_'.Str::random(5), 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $this->type->id, 'name' => 'A', 'order_index' => 1, 'weight' => 80]);
    $this->question = EvaluationQuestion::create(['evaluation_category_id' => $category->id, 'question_text' => 'Q', 'max_score' => 80, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);
});

function rd_review(object $ctx, ?int $score): ReviewAssignment
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');
    $assignment = ReviewAssignment::create([
        'proposal_id' => $ctx->proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $ctx->type->id,
        'assigned_by' => $ctx->central->id, 'status' => $score === null ? 'pending' : 'submitted',
        'assigned_at' => now(), 'submitted_at' => $score === null ? null : now(),
    ]);
    if ($score !== null) {
        ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $ctx->question->id, 'score' => $score]);
    }

    return $assignment;
}

function rd_process(object $ctx): Proposal
{
    app(ReviewScoreService::class)->processBlindReviewResult($ctx->proposal->fresh());

    return $ctx->proposal->fresh();
}

test('reviewers on opposite sides of the pass mark hold the automatic decision', function () {
    rd_review($this, 70);
    rd_review($this, 30);

    $proposal = rd_process($this);

    expect($proposal->status)->toBe('under_blind_review')
        ->and($proposal->review_disagreement_flagged_at)->not->toBeNull()
        ->and($proposal->review_disagreement['split_verdict'])->toBeTrue()
        ->and($proposal->review_disagreement['scores'][0]['label'])->toBe('Reviewer A')
        ->and(DB::table('notifications')->where('notifiable_id', $this->central->id)->where('type', 'review_disagreement')->count())->toBe(1);
});

test('a large gap holds the decision even when every reviewer passes it', function () {
    rd_review($this, 78);
    rd_review($this, 45); // gap 33/80 = 41% > 25%

    $proposal = rd_process($this);

    expect($proposal->status)->toBe('under_blind_review')
        ->and($proposal->review_disagreement['split_verdict'])->toBeFalse()
        ->and($proposal->review_disagreement['spread_pct'])->toBe(41.3);
});

test('reviewers in agreement are decided automatically as before', function () {
    rd_review($this, 62);
    rd_review($this, 58);

    $proposal = rd_process($this);

    expect($proposal->status)->toBe('blind_review_passed')
        ->and($proposal->review_disagreement_flagged_at)->toBeNull();
});

test('setting the limit to 0 turns the check off', function () {
    AppSetting::updateOrCreate(['key' => 'review_disagreement_threshold_pct'], ['value' => '0', 'type' => 'number', 'group' => 'thresholds']);
    rd_review($this, 70);
    rd_review($this, 30);

    expect(rd_process($this)->status)->toBe('blind_review_passed'); // average 50 >= 40
});

test('an added reviewer is waited for, and re-processing does not notify again', function () {
    rd_review($this, 70);
    rd_review($this, 30);
    rd_process($this);

    $third = rd_review($this, null);
    expect(rd_process($this)->status)->toBe('under_blind_review'); // waits for the third score

    $third->update(['status' => 'submitted', 'submitted_at' => now()]);
    ReviewScore::create(['review_assignment_id' => $third->id, 'evaluation_question_id' => $this->question->id, 'score' => 55]);
    $proposal = rd_process($this);

    expect($proposal->review_disagreement['scores'])->toHaveCount(3)
        ->and(DB::table('notifications')->where('notifiable_id', $this->central->id)->where('type', 'review_disagreement')->count())->toBe(1);
});

test('an officer can decide with the current scores, recording a moderation note', function () {
    rd_review($this, 70);
    rd_review($this, 30);
    rd_process($this);

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/blind-review/decide-disagreement", ['notes' => 'Second reviewer misread the scope; average stands.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'blind_review_passed');

    $log = DB::table('workflow_logs')->where('proposal_id', $this->proposal->id)->where('action', 'pass_blind_review')->first();
    expect($log->notes)->toContain('moderation note: Second reviewer misread the scope')
        ->and(json_decode($log->metadata, true)['moderated'])->toBeTrue()
        ->and($this->proposal->fresh()->review_disagreement_resolved_by)->toBe($this->central->id);
});

test('a college officer cannot decide, and a note is required', function () {
    rd_review($this, 70);
    rd_review($this, 30);
    rd_process($this);
    $collegeOfficer = User::factory()->create(['college_id' => $this->proposal->college_id]);
    $collegeOfficer->assignRole('college_officer');

    $this->actingAs($collegeOfficer, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/blind-review/decide-disagreement", ['notes' => 'Deciding this one now.'])
        ->assertForbidden();

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/blind-review/decide-disagreement", ['notes' => 'short'])
        ->assertStatus(422);
});

test('deciding is refused when nothing is on hold', function () {
    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/blind-review/decide-disagreement", ['notes' => 'Nothing to decide here at all.'])
        ->assertStatus(422);
});

// ─── Second opinion ──────────────────────────────────────────────────────────

/** A reviewer with expertise, optionally external, for the suggestions list. */
function rd_expert(array $expertise, bool $external = false, array $attrs = []): User
{
    $user = User::factory()->create(['expertise' => $expertise, 'status' => 'active'] + $attrs);
    $user->assignRole($external ? 'external_reviewer' : 'staff');

    return $user;
}

test('suggested second-opinion reviewers match the proposal and leave out the current reviewers', function () {
    $this->proposal->update(['keywords' => 'soil fertility, maize', 'title' => 'Soil fertility for maize']);
    $first = rd_review($this, 70);
    rd_review($this, 30);
    rd_process($this);
    $first->reviewer->update(['expertise' => ['Soil fertility']]);
    $first->reviewer->assignRole('staff');

    $expert = rd_expert(['Soil fertility', 'Agronomy'], external: true, attrs: ['affiliation' => 'Addis Ababa University']);
    rd_expert(['Medieval history']);

    $ids = collect($this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/second-opinion/suggestions")
        ->assertOk()->json('data'));

    expect($ids->pluck('id')->all())->toBe([$expert->id])
        ->and($ids->first())->toMatchArray(['is_external' => true, 'affiliation' => 'Addis Ababa University']);
});

test('a reviewer added while reviewers disagree becomes the second opinion, and the two closest scores decide', function () {
    rd_review($this, 70);           // A
    $low = rd_review($this, 20);    // B — the outlier
    rd_process($this);

    $expert = rd_expert(['Soil']);
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/review/add-reviewer", [
        'reviewer_id' => $expert->id, 'due_date' => now()->addWeek()->toDateString(),
    ])->assertSuccessful();

    $second = ReviewAssignment::where('reviewer_id', $expert->id)->first();
    expect($second->is_second_opinion)->toBeTrue()
        ->and($this->proposal->fresh()->review_disagreement['second_opinion']['reviewer'])->toBe($expert->name);

    // The second opinion agrees with A: A and C count, B is set aside.
    ReviewScore::create(['review_assignment_id' => $second->id, 'evaluation_question_id' => $this->question->id, 'score' => 64]);
    $second->update(['status' => 'submitted', 'submitted_at' => now()]);
    $proposal = rd_process($this);

    expect($proposal->status)->toBe('blind_review_passed')
        ->and($low->fresh()->set_aside_at)->not->toBeNull()
        ->and($second->fresh()->set_aside_at)->toBeNull()
        ->and($proposal->review_disagreement_resolved_at)->not->toBeNull()
        ->and($proposal->review_disagreement['settlement']['set_aside'][0]['label'])->toBe('Reviewer B');

    $log = DB::table('workflow_logs')->where('proposal_id', $proposal->id)->where('action', 'pass_blind_review')->first();
    expect($log->notes)->toContain('Average score: 67/80')
        ->and($log->notes)->toContain('Decided with a second opinion')
        ->and(json_decode($log->metadata, true)['second_opinion'])->toBeTrue();

    // The blind score everywhere else (combined score, results) leaves B out too.
    expect(app(ReviewScoreService::class)->recalculateSnapshot($proposal)['blind']['score'])->toEqual(67);
});

test('a second opinion that sides with the low score fails the proposal', function () {
    $high = rd_review($this, 70);
    rd_review($this, 20);
    rd_process($this);

    $second = rd_review($this, 25);
    $second->update(['is_second_opinion' => true]);
    $proposal = rd_process($this);

    expect($proposal->status)->toBe('rejected')
        ->and($high->fresh()->set_aside_at)->not->toBeNull();
});

test('only one second opinion can be pending at a time', function () {
    rd_review($this, 70);
    rd_review($this, 20);
    rd_process($this);

    $first = rd_expert(['Soil']);
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/review/add-reviewer", [
        'reviewer_id' => $first->id, 'due_date' => now()->addWeek()->toDateString(),
    ])->assertSuccessful();

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/review/add-reviewer", [
        'reviewer_id' => rd_expert(['Soil'])->id, 'due_date' => now()->addWeek()->toDateString(),
    ])->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, $first->name));
});

test('researchers cannot add reviewers or see second-opinion suggestions', function () {
    rd_review($this, 70);
    rd_review($this, 20);
    rd_process($this);
    $researcher = rd_expert(['Soil']);

    $this->actingAs($researcher, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/review/add-reviewer", [
        'reviewer_id' => rd_expert(['Soil'])->id, 'due_date' => now()->addWeek()->toDateString(),
    ])->assertForbidden();
    $this->actingAs($researcher, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/second-opinion/suggestions")->assertForbidden();
});
