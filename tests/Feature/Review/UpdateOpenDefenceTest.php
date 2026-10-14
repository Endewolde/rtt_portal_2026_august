<?php

use App\Models\College;
use App\Models\DefenceSession;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'UD'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'UDD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'ud-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    $this->proposal = Proposal::create([
        'tracker_number' => 'UD-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'under_open_defence', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    $this->blindType = EvaluationType::create(['name' => 'blind_review_ud', 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $this->defenceType = EvaluationType::create(['name' => 'open_defence_ud', 'label' => 'Defence', 'proposal_category' => 'research', 'is_active' => true]);

    $this->session = DefenceSession::create([
        'proposal_id' => $this->proposal->id, 'scheduled_date' => now()->addDays(2)->toDateString(), 'scheduled_time' => '10:00',
        'venue' => 'Hall A', 'status' => 'scheduled', 'scheduled_by' => $this->central->id,
    ]);
});

function ud_reviewer(): User
{
    $u = User::factory()->create(['status' => 'active']);
    $u->assignRole('staff');

    return $u;
}

function ud_assign(object $ctx, User $reviewer, EvaluationType $type, string $status = 'pending'): ReviewAssignment
{
    return ReviewAssignment::create([
        'proposal_id' => $ctx->proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $ctx->central->id, 'status' => $status, 'assigned_at' => now(),
    ]);
}

function ud_payload(object $ctx, array $reviewerIds, array $overrides = []): array
{
    return array_merge([
        'scheduled_date' => $ctx->session->scheduled_date->toDateString(),
        'scheduled_time' => '10:00', 'venue' => 'Hall A',
        'reviewer_ids' => $reviewerIds, 'evaluation_type_id' => $ctx->defenceType->id,
    ], $overrides);
}

test('a defence with no reviewers left can be given a new panel', function () {
    $a = ud_reviewer();
    $b = ud_reviewer();

    $this->actingAs($this->central, 'sanctum')
        ->putJson("/api/v1/proposals/{$this->proposal->id}/defence/session", ud_payload($this, [$a->id, $b->id]))
        ->assertOk()
        ->assertJsonPath('message', 'Open defence updated — 2 reviewer(s) added.');

    $assigned = ReviewAssignment::where('proposal_id', $this->proposal->id)->get();
    expect($assigned)->toHaveCount(2)
        ->and($assigned->pluck('evaluation_type_id')->unique()->all())->toBe([$this->defenceType->id])
        ->and($assigned->first()->due_date->toDateString())->toBe($this->session->scheduled_date->copy()->addDay()->toDateString())
        ->and(DB::table('notifications')->where('notifiable_id', $a->id)->where('type', 'review_assignment')->exists())->toBeTrue();
});

test('the current panel is returned pre-selected, and deselected reviewers are removed', function () {
    $keep = ud_reviewer();
    $drop = ud_reviewer();
    ud_assign($this, $keep, $this->defenceType);
    ud_assign($this, $drop, $this->defenceType);
    ud_assign($this, ud_reviewer(), $this->blindType, 'submitted'); // blind panel — not part of the defence

    $this->actingAs($this->central, 'sanctum')
        ->getJson("/api/v1/proposals/{$this->proposal->id}/defence/session")
        ->assertOk()
        ->assertJsonCount(2, 'data.assignments')
        ->assertJsonPath('data.session.venue', 'Hall A');

    $this->actingAs($this->central, 'sanctum')
        ->putJson("/api/v1/proposals/{$this->proposal->id}/defence/session", ud_payload($this, [$keep->id]))
        ->assertOk();

    expect(ReviewAssignment::where('reviewer_id', $drop->id)->exists())->toBeFalse()
        ->and(ReviewAssignment::where('reviewer_id', $keep->id)->exists())->toBeTrue();
});

test('a reviewer who already scored is never removed', function () {
    $scored = ud_reviewer();
    ud_assign($this, $scored, $this->defenceType, 'submitted');

    $this->actingAs($this->central, 'sanctum')
        ->putJson("/api/v1/proposals/{$this->proposal->id}/defence/session", ud_payload($this, []))
        ->assertOk()
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'already submitted a score'));

    expect(ReviewAssignment::where('reviewer_id', $scored->id)->exists())->toBeTrue();
});

test('moving the defence date resets the score deadline and reviewers\' due dates', function () {
    $reviewer = ud_reviewer();
    $assignment = ud_assign($this, $reviewer, $this->defenceType);
    $this->session->update(['score_deadline_extended_until' => now()->addDays(30), 'flagged_incomplete_at' => now()]);
    $newDate = now()->addDays(6)->toDateString();

    $this->actingAs($this->central, 'sanctum')
        ->putJson("/api/v1/proposals/{$this->proposal->id}/defence/session", ud_payload($this, [$reviewer->id], ['scheduled_date' => $newDate, 'venue' => 'Hall B']))
        ->assertOk();

    $session = $this->session->fresh();
    expect($session->venue)->toBe('Hall B')
        ->and($session->score_deadline_extended_until)->toBeNull()
        ->and($session->flagged_incomplete_at)->toBeNull()
        ->and($session->scoreDeadline()->toDateString())->toBe(now()->addDays(7)->toDateString())
        ->and($assignment->fresh()->due_date->toDateString())->toBe(now()->addDays(7)->toDateString());
});

test('only a proposal in open defence can be updated', function () {
    $this->proposal->update(['status' => 'blind_review_passed']);

    $this->actingAs($this->central, 'sanctum')
        ->putJson("/api/v1/proposals/{$this->proposal->id}/defence/session", ud_payload($this, []))
        ->assertStatus(422);
});

test('adding a single reviewer during open defence uses the defence evaluation type, not the blind one', function () {
    ud_assign($this, ud_reviewer(), $this->blindType, 'submitted');
    ud_assign($this, ud_reviewer(), $this->defenceType);
    $newcomer = ud_reviewer();

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/review/add-reviewer", [
            'reviewer_id' => $newcomer->id, 'due_date' => now()->addDays(3)->toDateString(),
        ])
        ->assertCreated();

    expect(ReviewAssignment::where('reviewer_id', $newcomer->id)->value('evaluation_type_id'))->toBe($this->defenceType->id);
});
