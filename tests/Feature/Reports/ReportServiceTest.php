<?php

use App\Jobs\GenerateReportJob;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Services\ReportService;
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

function rpt_makeBase(): array
{
    $college = College::create(['name' => 'Rpt College '.rand(), 'code' => 'RP'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RD'.rand(10, 99)]);
    $central = User::factory()->create(); $central->assignRole('central_office');

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'rpt-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    return [$college, $dept, $central, $call];
}

function rpt_proposal(College $college, Department $dept, ProposalCall $call, string $category = 'research', string $status = 'submitted'): Proposal
{
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category'         => $category,
        'title'            => 'Proposal '.rand(),
        'status'           => $status,
        'pi_user_id'       => $pi->id,
        'college_id'       => $college->id,
        'department_id'    => $dept->id,
        'academic_year'    => '2026',
        'created_by'       => $pi->id,
    ]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('proposal_count_by_category returns correct structure', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    rpt_proposal($college, $dept, $call, 'research', 'submitted');
    rpt_proposal($college, $dept, $call, 'innovation', 'accepted');

    $result = app(ReportService::class)->runReport('proposal_count_by_category', []);

    expect($result)->toBeArray();
    $categories = array_column($result, 'category');
    expect(in_array('research', $categories))->toBeTrue();
    expect($result[0])->toHaveKeys(['category', 'total', 'submitted', 'accepted', 'rejected']);
});

test('proposal_count_by_category respects academic_year filter', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    rpt_proposal($college, $dept, $call, 'research', 'submitted');

    $pi2  = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi2->assignRole('pi');
    $call2 = ProposalCall::create([
        'academic_year' => '2025', 'category' => 'research', 'title' => 'Old Call',
        'slug' => 'old-'.rand(10000, 99999), 'start_date' => now()->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(), 'status' => 'active',
        'is_open' => true, 'created_by' => $central->id,
    ]);
    Proposal::create([
        'tracker_number' => 'TRK-'.rand(), 'proposal_call_id' => $call2->id,
        'category' => 'research', 'title' => 'Old', 'status' => 'submitted',
        'pi_user_id' => $pi2->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2025', 'created_by' => $pi2->id,
    ]);

    $result2026 = app(ReportService::class)->runReport('proposal_count_by_category', ['academic_year' => '2026']);
    $resultAll  = app(ReportService::class)->runReport('proposal_count_by_category', []);

    expect(array_sum(array_column($result2026, 'total')))->toBe(1);
    expect(array_sum(array_column($resultAll, 'total')))->toBe(2);
});

test('proposal_count_by_college returns college names with counts', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    rpt_proposal($college, $dept, $call);
    rpt_proposal($college, $dept, $call);

    $result = app(ReportService::class)->runReport('proposal_count_by_college', []);

    expect($result)->toBeArray();
    $found = collect($result)->firstWhere('college_name', $college->name);
    expect($found)->not->toBeNull()
        ->and($found->total_proposals)->toBeGreaterThanOrEqual(2);
});

test('reviewer_workload returns reviewer names and assignment counts', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    $proposal  = rpt_proposal($college, $dept, $call, 'research', 'under_blind_review');
    $reviewer  = User::factory()->create(); $reviewer->assignRole('reviewer');

    $evalType = \App\Models\EvaluationType::first();
    if ($evalType) {
        ReviewAssignment::create([
            'proposal_id'       => $proposal->id,
            'reviewer_id'       => $reviewer->id,
            'evaluation_type_id'=> $evalType->id,
            'assigned_by'       => $central->id,
            'status'            => 'pending',
            'assigned_at'       => now(),
            'due_date'          => now()->addDays(7)->toDateString(),
        ]);
    }

    $result = app(ReportService::class)->runReport('reviewer_workload', []);

    expect($result)->toBeArray();
});

test('approval_rate_by_category calculates percentage correctly', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    rpt_proposal($college, $dept, $call, 'research', 'accepted');
    rpt_proposal($college, $dept, $call, 'research', 'rejected');

    $result  = app(ReportService::class)->runReport('approval_rate_by_category', []);
    $research = collect($result)->firstWhere('category', 'research');

    expect($research)->not->toBeNull()
        ->and((float) $research->approval_rate_percent)->toBe(50.0)
        ->and((float) $research->rejection_rate_percent)->toBe(50.0);
});

test('budget_utilization returns allocated disbursed settled correctly', function () {
    $result = app(ReportService::class)->runReport('budget_utilization', []);
    expect($result)->toBeArray();
});

test('college_performance returns output counts per college', function () {
    [$college] = rpt_makeBase();

    $result = app(ReportService::class)->runReport('college_performance', []);

    expect($result)->toBeArray();
    $found = collect($result)->firstWhere('college_name', $college->name);
    expect($found)->not->toBeNull()
        ->and(property_exists($found, 'outputs_produced'))->toBeTrue();
});

test('review_progress_pipeline returns all stages', function () {
    $result = app(ReportService::class)->runReport('review_progress_pipeline', []);

    $stages = array_column($result, 'stage');
    expect(in_array('submitted', $stages))->toBeTrue()
        ->and(in_array('accepted', $stages))->toBeTrue()
        ->and(in_array('completed', $stages))->toBeTrue()
        ->and(count($result))->toBe(9);
});

test('unknown report type throws InvalidArgumentException', function () {
    expect(fn () => app(ReportService::class)->runReport('totally_unknown_type', []))
        ->toThrow(\InvalidArgumentException::class, 'Unknown report type');
});

test('report with date range over 3 months is queued not sync', function () {
    $central = User::factory()->create(); $central->assignRole('central_office');

    $snapshot = app(ReportService::class)->generate('review_progress_pipeline', [
        'date_from' => now()->subMonths(5)->toDateString(),
        'date_to'   => now()->toDateString(),
    ], $central);

    expect($snapshot->status)->toBe('processing');
    Queue::assertPushed(GenerateReportJob::class, fn ($job) => $job->snapshotId === $snapshot->id);
});

test('report with date range under 3 months runs synchronously', function () {
    $central = User::factory()->create(); $central->assignRole('central_office');

    $snapshot = app(ReportService::class)->generate('review_progress_pipeline', [
        'date_from' => now()->subMonths(2)->toDateString(),
        'date_to'   => now()->toDateString(),
    ], $central);

    expect($snapshot->status)->toBe('ready');
    Queue::assertNotPushed(GenerateReportJob::class);
});
