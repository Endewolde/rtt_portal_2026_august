<?php

use App\Models\College;
use App\Models\Department;
use App\Models\MidtermEvaluation;
use App\Models\NotificationPreference;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\MidtermEvaluationService;
use Carbon\Carbon;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    Queue::fake();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function me_makeBase(): array
{
    $college = College::create(['name' => 'ME College '.rand(), 'code' => 'ME'.rand(10000, 99999)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'MD'.rand(10000, 99999)]);

    $central      = User::factory()->create(); $central->assignRole('central_officer');
    $collegeAdmin = User::factory()->create(['college_id' => $college->id]); $collegeAdmin->assignRole('college_officer');
    $pi           = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]); $pi->assignRole('pi');

    foreach ([$central, $collegeAdmin, $pi] as $u) {
        NotificationPreference::firstOrCreate(['user_id' => $u->id], [
            'email_enabled' => false, 'telegram_enabled' => false, 'inapp_enabled' => true,
        ]);
    }

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'me-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'ME Proposal', 'status' => 'funded',
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $pi, $central, $collegeAdmin];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('can schedule midterm for funded proposal', function () {
    [$proposal, $pi, $central] = me_makeBase();

    $evaluation = app(MidtermEvaluationService::class)
        ->schedule($proposal, Carbon::now()->addMonths(3), $central);

    expect($evaluation)->toBeInstanceOf(MidtermEvaluation::class)
        ->and($evaluation->proposal_id)->toBe($proposal->id)
        ->and($evaluation->status)->toBe('scheduled');
});

test('scheduling transitions proposal to midterm_evaluation', function () {
    [$proposal, $pi, $central] = me_makeBase();

    app(MidtermEvaluationService::class)->schedule($proposal, Carbon::now()->addMonths(3), $central);

    expect($proposal->fresh()->status)->toBe('midterm_evaluation');
});

test('PI can submit progress report', function () {
    [$proposal, $pi, $central] = me_makeBase();

    $evaluation = app(MidtermEvaluationService::class)
        ->schedule($proposal, Carbon::now()->addMonths(3), $central);

    $updated = app(MidtermEvaluationService::class)->submitReport($evaluation, $pi, [
        'progress_summary'                 => 'We have completed 70% of the planned objectives.',
        'financial_utilization_percentage' => 65.50,
        'publications_count'               => 2,
        'milestones_achieved'              => 'Data collection complete',
        'milestones_missed'                => null,
    ]);

    expect($updated->status)->toBe('report_submitted')
        ->and($updated->progress_summary)->toContain('70%')
        ->and((float) $updated->financial_utilization_percentage)->toBe(65.50);
});

test('report submission notifies college officer', function () {
    [$proposal, $pi, $central, $collegeAdmin] = me_makeBase();

    $evaluation = app(MidtermEvaluationService::class)
        ->schedule($proposal, Carbon::now()->addMonths(3), $central);

    Queue::fake();
    app(MidtermEvaluationService::class)->submitReport($evaluation, $pi, [
        'progress_summary' => 'Progress has been substantial across all planned activities.',
    ]);

    Queue::assertPushed(\App\Jobs\StoreInAppNotificationJob::class, fn ($job) =>
        $job->userId === $collegeAdmin->id && $job->event === 'midterm_report_submitted'
    );
});

test('college officer can score with continue recommendation', function () {
    [$proposal, $pi, $central, $collegeAdmin] = me_makeBase();
    $service = app(MidtermEvaluationService::class);

    $evaluation = $service->schedule($proposal, Carbon::now()->addMonths(3), $central);
    $service->submitReport($evaluation, $pi, ['progress_summary' => 'Good progress on all fronts.']);
    $scored = $service->score($evaluation->fresh(), $collegeAdmin, [
        'progress_score' => 82.5,
        'comments'       => 'Excellent progress demonstrated.',
        'recommendation' => 'continue',
    ]);

    expect($scored->status)->toBe('scored')
        ->and($scored->recommendation)->toBe('continue')
        ->and((float) $scored->progress_score)->toBe(82.5)
        ->and($scored->scored_by)->toBe($collegeAdmin->id);
});

test('college officer can score with hold recommendation', function () {
    [$proposal, $pi, $central, $collegeAdmin] = me_makeBase();
    $service = app(MidtermEvaluationService::class);

    $evaluation = $service->schedule($proposal, Carbon::now()->addMonths(3), $central);
    $service->submitReport($evaluation, $pi, ['progress_summary' => 'Limited progress due to challenges.']);
    $scored = $service->score($evaluation->fresh(), $collegeAdmin, [
        'progress_score' => 40.0,
        'comments'       => 'Significant delays observed.',
        'recommendation' => 'hold',
    ]);

    expect($scored->recommendation)->toBe('hold');
});

test('hold recommendation notifies PI and Central Office', function () {
    [$proposal, $pi, $central, $collegeAdmin] = me_makeBase();
    $service = app(MidtermEvaluationService::class);

    $evaluation = $service->schedule($proposal, Carbon::now()->addMonths(3), $central);
    $service->submitReport($evaluation, $pi, ['progress_summary' => 'Very limited progress unfortunately.']);

    Queue::fake();
    $service->score($evaluation->fresh(), $collegeAdmin, [
        'progress_score' => 30.0, 'comments' => 'Delays', 'recommendation' => 'hold',
    ]);

    Queue::assertPushed(\App\Jobs\StoreInAppNotificationJob::class, fn ($job) =>
        $job->userId === $pi->id && $job->event === 'midterm_hold'
    );
    Queue::assertPushed(\App\Jobs\StoreInAppNotificationJob::class, fn ($job) =>
        $job->userId === $central->id && $job->event === 'midterm_hold'
    );
});

test('cannot score without submitted report first', function () {
    [$proposal, $pi, $central, $collegeAdmin] = me_makeBase();

    $evaluation = app(MidtermEvaluationService::class)
        ->schedule($proposal, Carbon::now()->addMonths(3), $central);

    expect(fn () => app(MidtermEvaluationService::class)->score($evaluation, $collegeAdmin, [
        'progress_score' => 75.0, 'comments' => 'OK', 'recommendation' => 'continue',
    ]))->toThrow(\Exception::class, 'submitted report');
});

test('recommendation must be continue or hold', function () {
    [$proposal, $pi, $central, $collegeAdmin] = me_makeBase();
    $service = app(MidtermEvaluationService::class);

    $evaluation = $service->schedule($proposal, Carbon::now()->addMonths(3), $central);
    $service->submitReport($evaluation, $pi, ['progress_summary' => 'Some progress was made overall.']);

    expect(fn () => $service->score($evaluation->fresh(), $collegeAdmin, [
        'progress_score' => 75.0, 'comments' => 'OK', 'recommendation' => 'invalid_value',
    ]))->toThrow(\InvalidArgumentException::class);
});
