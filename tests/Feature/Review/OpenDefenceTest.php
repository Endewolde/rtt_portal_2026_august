<?php

use App\Models\College;
use App\Models\Department;
use App\Models\DefenceSession;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use App\Services\DefenceSessionService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProposalAt(string $status): array
{
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'C'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'D'.rand(10, 99)]);
    $call    = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'c-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'TRK-'.rand(10000, 99999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Test', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    ProposalMember::create([
        'proposal_id' => $proposal->id, 'user_id' => $pi->id,
        'role' => 'pi', 'status' => 'active', 'joined_at' => now(),
    ]);

    return [$proposal, $central, $pi];
}

function createCompletedAssignment(Proposal $proposal, EvaluationType $type, User $assignedBy, int $score, int $maxScore = 5, int $qCount = 2): ReviewAssignment
{
    $cat = EvaluationCategory::create([
        'evaluation_type_id' => $type->id, 'name' => 'Cat'.rand(),
        'order_index' => 1, 'weight' => 100,
    ]);

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $assignment = ReviewAssignment::create([
        'proposal_id'        => $proposal->id,
        'reviewer_id'        => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by'        => $assignedBy->id,
        'status'             => 'submitted',
        'assigned_at'        => now(),
        'submitted_at'       => now(),
    ]);

    for ($i = 0; $i < $qCount; $i++) {
        $q = EvaluationQuestion::create([
            'evaluation_category_id' => $cat->id,
            'question_text'          => "Q{$i}",
            'max_score'              => $maxScore,
            'weight'                 => 1.00,
            'is_required'            => true,
            'order_index'            => $i + 1,
        ]);

        ReviewScore::create([
            'review_assignment_id'   => $assignment->id,
            'evaluation_question_id' => $q->id,
            'score'                  => $score,
        ]);
    }

    return $assignment;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('can schedule defence for blind_review_passed proposal', function () {
    [$proposal, $central] = makeProposalAt('blind_review_passed');

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $defenceType = EvaluationType::create([
        'name' => 'open_defence_research_'.rand(100, 999),
        'label' => 'Open Defence Test', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    $service = app(DefenceSessionService::class);

    $session = $service->schedule($proposal, [
        'date'               => now()->addDays(7)->toDateString(),
        'time'               => '10:00:00',
        'venue'              => 'Main Hall',
        'reviewer_ids'       => [$reviewer->id],
        'evaluation_type_id' => $defenceType->id,
    ], $central);

    expect($session)->toBeInstanceOf(DefenceSession::class)
        ->and($session->proposal_id)->toBe($proposal->id)
        ->and($session->venue)->toBe('Main Hall');
});

test('defence scheduling transitions proposal to under_open_defence', function () {
    [$proposal, $central] = makeProposalAt('blind_review_passed');

    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $defenceType = EvaluationType::create([
        'name' => 'open_defence_research_'.rand(100, 999),
        'label' => 'Open Defence', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    $service = app(DefenceSessionService::class);

    $service->schedule($proposal, [
        'date'               => now()->addDays(7)->toDateString(),
        'time'               => '09:00:00',
        'venue'              => 'Room A',
        'reviewer_ids'       => [$reviewer->id],
        'evaluation_type_id' => $defenceType->id,
    ], $central);

    expect(Proposal::find($proposal->id)->status)->toBe('under_open_defence');
});

test('combined score equals blind_score plus defence_score', function () {
    [$proposal, $central] = makeProposalAt('under_open_defence');

    $blindType = EvaluationType::create([
        'name' => 'blind_review_research_'.rand(100, 999),
        'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    $defenceType = EvaluationType::create([
        'name' => 'open_defence_research_'.rand(100, 999),
        'label' => 'Defence', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    // blind: 4/5 = 80%, defence: 3/5 = 60%, combined = 140
    createCompletedAssignment($proposal, $blindType, $central, 4, 5, 2);
    createCompletedAssignment($proposal, $defenceType, $central, 3, 5, 2);

    $session = DefenceSession::create([
        'proposal_id' => $proposal->id, 'scheduled_date' => now()->toDateString(),
        'scheduled_time' => '10:00:00', 'venue' => 'Hall', 'status' => 'scheduled',
        'scheduled_by' => $central->id,
    ]);

    $service = app(DefenceSessionService::class);
    $service->processDefenceResult($session, $central);

    $session->refresh();
    expect((float) $session->final_score)->toBe(140.0); // 80 + 60
});

test('proposal accepted when combined score >= 120', function () {
    [$proposal, $central] = makeProposalAt('under_open_defence');

    $blindType = EvaluationType::create([
        'name' => 'blind_review_research_'.rand(100, 999),
        'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    $defenceType = EvaluationType::create([
        'name' => 'open_defence_research_'.rand(100, 999),
        'label' => 'Defence', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    // 80% + 80% = 160 >= 120 → accepted
    createCompletedAssignment($proposal, $blindType, $central, 4, 5, 2);
    createCompletedAssignment($proposal, $defenceType, $central, 4, 5, 2);

    $session = DefenceSession::create([
        'proposal_id' => $proposal->id, 'scheduled_date' => now()->toDateString(),
        'scheduled_time' => '10:00:00', 'venue' => 'Hall', 'status' => 'scheduled',
        'scheduled_by' => $central->id,
    ]);

    $result = app(DefenceSessionService::class)->processDefenceResult($session, $central);

    expect($result->status)->toBe('accepted');
});

test('proposal rejected when combined score < 120', function () {
    [$proposal, $central] = makeProposalAt('under_open_defence');

    $blindType = EvaluationType::create([
        'name' => 'blind_review_research_'.rand(100, 999),
        'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    $defenceType = EvaluationType::create([
        'name' => 'open_defence_research_'.rand(100, 999),
        'label' => 'Defence', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    // 40% + 40% = 80 < 120 → rejected
    createCompletedAssignment($proposal, $blindType, $central, 2, 5, 2);
    createCompletedAssignment($proposal, $defenceType, $central, 2, 5, 2);

    $session = DefenceSession::create([
        'proposal_id' => $proposal->id, 'scheduled_date' => now()->toDateString(),
        'scheduled_time' => '10:00:00', 'venue' => 'Hall', 'status' => 'scheduled',
        'scheduled_by' => $central->id,
    ]);

    $result = app(DefenceSessionService::class)->processDefenceResult($session, $central);

    expect($result->status)->toBe('rejected');
});
