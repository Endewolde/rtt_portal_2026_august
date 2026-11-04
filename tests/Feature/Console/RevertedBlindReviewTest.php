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
use App\Models\User;
use App\Services\RevertedBlindReviewService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->type = EvaluationType::create(['name' => 'blind_review_rbr_'.rand(100, 999), 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $this->type->id, 'name' => 'Cat', 'order_index' => 1, 'weight' => 100]);
    $this->questions = collect(range(1, 4))->map(fn ($i) => EvaluationQuestion::create([
        'evaluation_category_id' => $category->id, 'question_text' => "Q{$i}", 'max_score' => 5,
        'weight' => 1.00, 'is_required' => true, 'order_index' => $i,
    ]));
});

function rbr_log(Proposal $proposal, User $actor, string $action, string $from, string $to, int $minutesAgo): void
{
    DB::table('workflow_logs')->insert([
        'id' => Str::uuid()->toString(), 'proposal_id' => $proposal->id, 'from_stage' => $from, 'action' => $action,
        'to_stage' => $to, 'actor_id' => $actor->id, 'notes' => null, 'metadata' => null, 'created_at' => now()->subMinutes($minutesAgo),
    ]);
}

/** A proposal at validated after the old removal bug: one blind review submitted with the given score, the other reviewer removed. */
function rbr_reverted(object $ctx, ?int $score, string $assignmentStatus = 'submitted'): Proposal
{
    $pi = User::factory()->create();
    $pi->assignRole('staff');
    $college = College::create(['name' => 'C'.rand(), 'code' => 'RB'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'rbr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $ctx->central->id,
    ]);
    $proposal = Proposal::create([
        'tracker_number' => 'RBR-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'P', 'status' => 'validated', 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    rbr_log($proposal, $ctx->central, 'validate', 'submitted', 'validated', 30);
    rbr_log($proposal, $ctx->central, 'assign_for_review', 'validated', 'under_blind_review', 20);
    rbr_log($proposal, $ctx->central, 'unassign_reviewers', 'under_blind_review', 'validated', 10);

    if ($score !== null) {
        $reviewer = User::factory()->create();
        $reviewer->assignRole('reviewer');
        $assignment = ReviewAssignment::create([
            'proposal_id' => $proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $ctx->type->id,
            'assigned_by' => $ctx->central->id, 'status' => $assignmentStatus, 'assigned_at' => now(), 'submitted_at' => now(),
        ]);
        $ctx->questions->each(fn ($q) => ReviewScore::create(['review_assignment_id' => $assignment->id, 'evaluation_question_id' => $q->id, 'score' => $score]));
    }

    return $proposal;
}

test('the audit lists a reverted proposal with a submitted blind review and changes nothing', function () {
    $proposal = rbr_reverted($this, 4);

    expect(Artisan::call('reviews:audit-reverted-blind-review'))->toBe(0)
        ->and(Artisan::output())->toContain($proposal->tracker_number)
        ->toContain('80/100 (pass mark 60)')
        ->toContain('Passes blind review');
    expect($proposal->fresh()->status)->toBe('validated');
});

test('the restore is a dry run unless forced', function () {
    $proposal = rbr_reverted($this, 4);

    $this->artisan('reviews:restore-reverted-blind-review')->expectsOutputToContain('DRY RUN')->assertSuccessful();

    expect($proposal->fresh()->status)->toBe('validated');
});

test('forcing the restore moves a passing proposal on to open defence without telling the PI it entered blind review again', function () {
    $proposal = rbr_reverted($this, 4);

    $this->artisan('reviews:restore-reverted-blind-review --force')->assertSuccessful();

    expect($proposal->fresh()->status)->toBe('blind_review_passed')
        ->and(DB::table('workflow_logs')->where('proposal_id', $proposal->id)->orderByDesc('created_at')->orderByDesc('id')->pluck('action')->take(2)->sort()->values()->all())
        ->toBe(['assign_for_review', 'pass_blind_review'])
        ->and(DB::table('notifications')->where('notifiable_id', $proposal->pi_user_id)->where('data', 'like', '%entered the blind review phase%')->exists())
        ->toBeFalse();
});

test('a proposal below the pass mark is never rejected by the script — it is left for an officer', function () {
    $proposal = rbr_reverted($this, 1);

    $this->artisan('reviews:restore-reverted-blind-review --force')
        ->expectsOutputToContain('Left as is')
        ->assertSuccessful();

    expect($proposal->fresh()->status)->toBe('validated');
});

test('proposals that are not stuck are left out', function () {
    $noReview = rbr_reverted($this, null);                     // reverted, but nobody had submitted
    $stillReviewing = rbr_reverted($this, 4, 'in_progress');   // a reviewer is still working
    $freshlyValidated = rbr_reverted($this, 4);
    rbr_log($freshlyValidated, $this->central, 'withdraw_report_resume_review', 'blind_review_passed', 'validated', 1);

    $stuck = app(RevertedBlindReviewService::class)->stuck()->pluck('id');

    expect($stuck)->not->toContain($noReview->id)
        ->not->toContain($stillReviewing->id)
        ->not->toContain($freshlyValidated->id);
});
