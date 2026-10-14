<?php

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
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    ThresholdSetting::updateOrCreate(['key' => 'blind_threshold'], ['value' => 0]);
    ThresholdSetting::updateOrCreate(['key' => 'defence_threshold'], ['value' => 0]);
    ThresholdSetting::updateOrCreate(['key' => 'combined_threshold'], ['value' => 70]);
});

function cod_makeProposal(string $status): array
{
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $college = College::create(['name' => 'C'.rand(), 'code' => 'OD'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'ODD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'od-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $superAdmin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'OD-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => $status,
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $superAdmin];
}

function cod_score(Proposal $proposal, User $actor, string $typePrefix, int $weight, int $score): void
{
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $type = EvaluationType::create(['name' => $typePrefix.'_cod_'.Str::random(6), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $cat = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'A', 'order_index' => 1, 'weight' => $weight]);
    $q = EvaluationQuestion::create(['evaluation_category_id' => $cat->id, 'question_text' => 'Q', 'max_score' => $weight, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $assignment = ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id, 'assigned_by' => $actor->id,
        'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now(),
    ]);
    ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $q->id, 'score' => $score]);
}

/**
 * Blind is scored out of 80 and defence out of 20, so combined is out of 100
 * against the combined_threshold of 70 set in beforeEach.
 */
function cod_scoreBoth(Proposal $proposal, User $actor, int $blind, int $defence): void
{
    cod_score($proposal, $actor, 'blind_review', 80, $blind);
    cod_score($proposal, $actor, 'open_defence', 20, $defence);
}

function cod_logDecision(Proposal $proposal, User $actor, string $action, string $to): void
{
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(),
        'proposal_id' => $proposal->id,
        'from_stage' => 'under_open_defence',
        'action' => $action,
        'to_stage' => $to,
        'actor_id' => $actor->id,
        'notes' => null,
        'metadata' => null,
        'created_at' => now(),
    ]);
}

test('dry run reports a wrongly-accepted proposal but does not change its status', function () {
    [$proposal, $actor] = cod_makeProposal('accepted');
    cod_scoreBoth($proposal, $actor, 50, 10); // 60/100, below combined threshold of 70
    cod_logDecision($proposal, $actor, 'pass_defence', 'accepted');

    $exitCode = Artisan::call('reviews:correct-open-defence');
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('DRY RUN')
        ->and(Proposal::find($proposal->id)->status)->toBe('accepted');
});

test('--force corrects a wrongly-accepted proposal still awaiting central evaluation', function () {
    [$proposal, $actor] = cod_makeProposal('accepted');
    cod_scoreBoth($proposal, $actor, 50, 10);
    cod_logDecision($proposal, $actor, 'pass_defence', 'accepted');

    $exitCode = Artisan::call('reviews:correct-open-defence', ['--force' => true]);
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('corrected')
        ->and(Proposal::find($proposal->id)->status)->toBe('rejected');

    $log = DB::table('workflow_logs')
        ->where('proposal_id', $proposal->id)
        ->where('action', 'fail_defence')
        ->where('from_stage', 'accepted')
        ->first();
    expect($log)->not->toBeNull();
    expect(json_decode($log->metadata, true)['corrected'])->toBeTrue();
});

test('--force does NOT touch a wrongly-accepted proposal that has already been funded', function () {
    [$proposal, $actor] = cod_makeProposal('funded');
    cod_scoreBoth($proposal, $actor, 50, 10);
    cod_logDecision($proposal, $actor, 'pass_defence', 'accepted');

    $exitCode = Artisan::call('reviews:correct-open-defence', ['--force' => true]);
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('manual review')
        ->and(Proposal::find($proposal->id)->status)->toBe('funded');
});

test('a wrongly-rejected proposal is reported but never auto-reopened (terminal stage)', function () {
    [$proposal, $actor] = cod_makeProposal('rejected');
    cod_scoreBoth($proposal, $actor, 70, 15); // 85/100, clears the combined threshold
    cod_logDecision($proposal, $actor, 'fail_defence', 'rejected');

    $exitCode = Artisan::call('reviews:correct-open-defence', ['--force' => true]);
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain($proposal->tracker_number)
        ->and($output)->toContain('terminal stage')
        ->and(Proposal::find($proposal->id)->status)->toBe('rejected');
});

test('reports nothing to do when every decision already matches current thresholds', function () {
    [$proposal, $actor] = cod_makeProposal('accepted');
    cod_scoreBoth($proposal, $actor, 70, 15);
    cod_logDecision($proposal, $actor, 'pass_defence', 'accepted');

    $exitCode = Artisan::call('reviews:correct-open-defence', ['--force' => true]);
    $output = Artisan::output();

    expect($exitCode)->toBe(0)
        ->and($output)->toContain('nothing to do');
});
