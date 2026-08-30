<?php

use App\Jobs\GenerateReportJob;
use App\Models\College;
use App\Models\Complaint;
use App\Models\Department;
use App\Models\EvaluationType;
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
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RD'.rand(10, 99)]);
    $central = User::factory()->create();
    $central->assignRole('central_officer');

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
        'tracker_number' => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category' => $category,
        'title' => 'Proposal '.rand(),
        'status' => $status,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2026',
        'created_by' => $pi->id,
    ]);
}

function rpt_complaint(Proposal $proposal, string $level = 'college', string $status = 'open', ?int $resolvedDaysAfter = null): Complaint
{
    $complainant = User::factory()->create();
    $complainant->assignRole('pi');

    $complaint = Complaint::create([
        'proposal_id' => $proposal->id,
        'complainant_id' => $complainant->id,
        'stage' => 'blind_review',
        'level' => $level,
        'description' => 'Something went wrong.',
        'status' => $status,
    ]);

    if ($resolvedDaysAfter !== null) {
        $complaint->update([
            'resolved_at' => $complaint->created_at->copy()->addDays($resolvedDaysAfter),
        ]);
    }

    return $complaint;
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

    $pi2 = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
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
    $resultAll = app(ReportService::class)->runReport('proposal_count_by_category', []);

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

test('proposal_trend_by_year groups by academic year regardless of the academic_year filter', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();

    $callYearOne = ProposalCall::create([
        'academic_year' => '2025', 'category' => 'research',
        'title' => 'Call 2025', 'slug' => 'rpt-y1-'.rand(10000, 99999),
        'start_date' => now()->subYear()->toDateString(), 'end_date' => now()->subMonths(9)->toDateString(),
        'status' => 'closed', 'is_open' => false, 'created_by' => $central->id,
    ]);
    $piYearOne = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $piYearOne->assignRole('pi');
    Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999), 'proposal_call_id' => $callYearOne->id,
        'category' => 'research', 'title' => 'Old year proposal', 'status' => 'funded',
        'pi_user_id' => $piYearOne->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2025', 'created_by' => $piYearOne->id,
    ]);

    rpt_proposal($college, $dept, $call, 'research', 'funded');
    rpt_proposal($college, $dept, $call, 'research', 'rejected');

    // Passing a specific academic_year filter must NOT narrow this report — the
    // whole point is comparing across years.
    $result = app(ReportService::class)->runReport('proposal_trend_by_year', ['academic_year' => '2026']);
    $years = array_column($result, 'academic_year');

    expect($years)->toContain('2025')->toContain('2026');

    $row2026 = collect($result)->firstWhere('academic_year', '2026');
    expect((int) $row2026->submitted)->toBe(2)
        ->and((int) $row2026->funded)->toBe(1)
        ->and((int) $row2026->rejected)->toBe(1);
});

test('proposal_trend_by_year respects college_id filter', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    [$collegeB, $deptB] = rpt_makeBase();

    rpt_proposal($collegeA, $deptA, $callA, 'research', 'funded');

    $result = app(ReportService::class)->runReport('proposal_trend_by_year', ['college_id' => $collegeB->id]);

    expect($result)->toBe([]);
});

test('reviewer_workload returns reviewer names and assignment counts', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    $proposal = rpt_proposal($college, $dept, $call, 'research', 'under_blind_review');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $evalType = EvaluationType::first();
    if ($evalType) {
        ReviewAssignment::create([
            'proposal_id' => $proposal->id,
            'reviewer_id' => $reviewer->id,
            'evaluation_type_id' => $evalType->id,
            'assigned_by' => $central->id,
            'status' => 'pending',
            'assigned_at' => now(),
            'due_date' => now()->addDays(7)->toDateString(),
        ]);
    }

    $result = app(ReportService::class)->runReport('reviewer_workload', []);

    expect($result)->toBeArray();
});

test('approval_rate_by_category calculates percentage correctly', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    rpt_proposal($college, $dept, $call, 'research', 'accepted');
    rpt_proposal($college, $dept, $call, 'research', 'rejected');

    $result = app(ReportService::class)->runReport('approval_rate_by_category', []);
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
        ->toThrow(InvalidArgumentException::class, 'Unknown report type');
});

test('report with date range over 3 months is queued not sync', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $snapshot = app(ReportService::class)->generate('review_progress_pipeline', [
        'date_from' => now()->subMonths(5)->toDateString(),
        'date_to' => now()->toDateString(),
    ], $central);

    expect($snapshot->status)->toBe('processing');
    Queue::assertPushed(GenerateReportJob::class, fn ($job) => $job->snapshotId === $snapshot->id);
});

test('report with date range under 3 months runs synchronously', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $snapshot = app(ReportService::class)->generate('review_progress_pipeline', [
        'date_from' => now()->subMonths(2)->toDateString(),
        'date_to' => now()->toDateString(),
    ], $central);

    expect($snapshot->status)->toBe('ready');
    Queue::assertNotPushed(GenerateReportJob::class);
});

// ─── College scoping ─────────────────────────────────────────────────────────

test('proposal_count_by_college filters down to a single college when college_id is passed', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RB'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RD'.rand(10, 99)]);

    rpt_proposal($collegeA, $deptA, $callA);
    rpt_proposal($collegeB, $deptB, $callA);

    $result = app(ReportService::class)->runReport('proposal_count_by_college', ['college_id' => $collegeA->id]);

    $names = collect($result)->pluck('college_name');
    expect($names)->toContain($collegeA->name)
        ->not->toContain($collegeB->name);
});

test('college_performance filters down to a single college when college_id is passed', function () {
    [$collegeA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RB2'.rand(10, 99)]);

    $result = app(ReportService::class)->runReport('college_performance', ['college_id' => $collegeA->id]);

    $names = collect($result)->pluck('college_name');
    expect($names)->toContain($collegeA->name)
        ->not->toContain($collegeB->name);
});

test('reviewer_workload only counts assignments for proposals in the given college', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RB3'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RD3'.rand(10, 99)]);

    $proposalA = rpt_proposal($collegeA, $deptA, $callA, 'research', 'under_blind_review');
    $proposalB = rpt_proposal($collegeB, $deptB, $callA, 'research', 'under_blind_review');

    $reviewerA = User::factory()->create(['name' => 'Reviewer A College']);
    $reviewerA->assignRole('reviewer');
    $reviewerB = User::factory()->create(['name' => 'Reviewer B College']);
    $reviewerB->assignRole('reviewer');

    $evalType = EvaluationType::firstOrCreate(['name' => 'blind_review'], ['label' => 'Blind Review', 'is_active' => true]);

    ReviewAssignment::create([
        'proposal_id' => $proposalA->id, 'reviewer_id' => $reviewerA->id, 'evaluation_type_id' => $evalType->id,
        'assigned_by' => $central->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->addDays(7)->toDateString(),
    ]);
    ReviewAssignment::create([
        'proposal_id' => $proposalB->id, 'reviewer_id' => $reviewerB->id, 'evaluation_type_id' => $evalType->id,
        'assigned_by' => $central->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->addDays(7)->toDateString(),
    ]);

    $result = app(ReportService::class)->runReport('reviewer_workload', ['college_id' => $collegeA->id]);

    $names = collect($result)->pluck('reviewer_name');
    expect($names)->toContain('Reviewer A College')
        ->not->toContain('Reviewer B College');
});

test('college officer cannot generate a report for another college via the API', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RB4'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RD4'.rand(10, 99)]);

    rpt_proposal($collegeA, $deptA, $callA);
    rpt_proposal($collegeB, $deptB, $callA);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->postJson('/api/v1/reports/generate', [
        'type' => 'proposal_count_by_college',
        'filters' => ['college_id' => $collegeB->id], // attempting to spoof another college
    ]);

    $response->assertOk();
    $names = collect($response->json('data.result'))->pluck('college_name');
    expect($names)->toContain($collegeA->name)
        ->not->toContain($collegeB->name);
});

test('a user without a reporting role cannot generate reports', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')
        ->postJson('/api/v1/reports/generate', ['type' => 'proposal_count_by_category'])
        ->assertForbidden();
});

test('a user cannot view another user\'s report snapshot unless admin-tier', function () {
    [$collegeA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RB5'.rand(10, 99)]);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');
    $officerB = User::factory()->create(['college_id' => $collegeB->id]);
    $officerB->assignRole('college_officer');

    $snapshot = app(ReportService::class)->generate('proposal_count_by_category', [], $officerA);

    $this->actingAs($officerB, 'sanctum')
        ->getJson("/api/v1/reports/{$snapshot->id}")
        ->assertForbidden();

    $this->actingAs($officerA, 'sanctum')
        ->getJson("/api/v1/reports/{$snapshot->id}")
        ->assertOk();

    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $this->actingAs($central, 'sanctum')
        ->getJson("/api/v1/reports/{$snapshot->id}")
        ->assertOk();
});

// ─── Complaint summary ───────────────────────────────────────────────────────

test('complaint_summary counts totals, resolution outcomes, and levels correctly', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    $proposal = rpt_proposal($college, $dept, $call);

    rpt_complaint($proposal, level: 'college', status: 'open');
    rpt_complaint($proposal, level: 'college', status: 'resolved', resolvedDaysAfter: 4);
    rpt_complaint($proposal, level: 'officer', status: 'dismissed', resolvedDaysAfter: 2);
    rpt_complaint($proposal, level: 'officer', status: 'under_review');

    $result = app(ReportService::class)->runReport('complaint_summary', []);
    $row = collect($result)->firstWhere('college_name', $college->name);

    expect($row)->not->toBeNull()
        ->and((int) $row->total_complaints)->toBe(4)
        ->and((int) $row->unresolved)->toBe(2)
        ->and((int) $row->resolved)->toBe(1)
        ->and((int) $row->dismissed)->toBe(1)
        ->and((int) $row->level_1_college)->toBe(2)
        ->and((int) $row->level_2_officer)->toBe(2)
        ->and((float) $row->avg_resolution_days)->toBe(3.0);
});

test('complaint_summary filters down to a single college when college_id is passed', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RC'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RDC'.rand(10, 99)]);

    $proposalA = rpt_proposal($collegeA, $deptA, $callA);
    $proposalB = rpt_proposal($collegeB, $deptB, $callA);
    rpt_complaint($proposalA);
    rpt_complaint($proposalB);

    $result = app(ReportService::class)->runReport('complaint_summary', ['college_id' => $collegeA->id]);

    $names = collect($result)->pluck('college_name');
    expect($names)->toContain($collegeA->name)
        ->not->toContain($collegeB->name);
});

test('college officer generating a complaint report via the API only sees their own college', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RD'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RDD'.rand(10, 99)]);

    $proposalA = rpt_proposal($collegeA, $deptA, $callA);
    $proposalB = rpt_proposal($collegeB, $deptB, $callA);
    rpt_complaint($proposalA);
    rpt_complaint($proposalB);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->postJson('/api/v1/reports/generate', [
        'type' => 'complaint_summary',
        'filters' => ['college_id' => $collegeB->id],
    ]);

    $response->assertOk();
    $names = collect($response->json('data.result'))->pluck('college_name');
    expect($names)->toContain($collegeA->name)
        ->not->toContain($collegeB->name);
});

// ─── Report builder ──────────────────────────────────────────────────────────

test('builder options endpoint exposes the whitelisted subjects, dimensions, and metrics', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/reports/builder-options');

    $response->assertOk();
    $data = $response->json('data');

    expect($data)->toHaveKeys(['proposals', 'complaints', 'review_workload']);
    expect($data['complaints']['dimensions'])->toContain('college', 'status', 'level');
    expect($data['complaints']['metrics'])->toContain('count', 'avg_resolution_days');
    expect($data['proposals']['filters'])->toContain('college_id', 'category', 'status', 'academic_year');
    expect($data['complaints']['filters'])->toContain('college_id', 'status', 'level', 'complaint_type', 'academic_year');
    expect($data['review_workload']['filters'])->toContain('college_id', 'status', 'academic_year');
});

test('custom_builder filters proposals by category and status', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    rpt_proposal($collegeA, $deptA, $callA, 'research', 'funded');
    rpt_proposal($collegeA, $deptA, $callA, 'research', 'rejected');
    rpt_proposal($collegeA, $deptA, $callA, 'innovation', 'funded');

    $result = app(ReportService::class)->runReport('custom_builder', [
        'subject' => 'proposals',
        'dimensions' => [],
        'metrics' => ['count'],
        'category' => 'research',
        'status' => 'funded',
    ]);

    expect((int) $result['rows'][0]['count'])->toBe(1);
});

test('custom_builder filters complaints by level and complaint_type', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    $proposal = rpt_proposal($college, $dept, $call);

    rpt_complaint($proposal, level: 'college', status: 'open');
    rpt_complaint($proposal, level: 'officer', status: 'open');

    $result = app(ReportService::class)->runReport('custom_builder', [
        'subject' => 'complaints',
        'dimensions' => [],
        'metrics' => ['count'],
        'level' => 'officer',
    ]);

    expect((int) $result['rows'][0]['count'])->toBe(1);
});

test('custom_builder filters review_workload by status', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    $proposal = rpt_proposal($college, $dept, $call, 'research', 'under_blind_review');
    $reviewerA = User::factory()->create();
    $reviewerA->assignRole('reviewer');
    $reviewerB = User::factory()->create();
    $reviewerB->assignRole('reviewer');
    $evalType = EvaluationType::firstOrCreate(['name' => 'blind_review'], ['label' => 'Blind Review', 'is_active' => true]);

    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewerA->id, 'evaluation_type_id' => $evalType->id,
        'assigned_by' => $central->id, 'status' => 'submitted', 'assigned_at' => now(), 'due_date' => now()->addDays(7)->toDateString(),
    ]);
    ReviewAssignment::create([
        'proposal_id' => $proposal->id, 'reviewer_id' => $reviewerB->id, 'evaluation_type_id' => $evalType->id,
        'assigned_by' => $central->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->addDays(7)->toDateString(),
    ]);

    $result = app(ReportService::class)->runReport('custom_builder', [
        'subject' => 'review_workload',
        'dimensions' => [],
        'metrics' => ['count'],
        'status' => 'submitted',
    ]);

    expect((int) $result['rows'][0]['count'])->toBe(1);
});

test('custom_builder groups proposals by college and category with the chosen metrics', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    rpt_proposal($collegeA, $deptA, $callA, 'research', 'funded');
    rpt_proposal($collegeA, $deptA, $callA, 'research', 'rejected');
    rpt_proposal($collegeA, $deptA, $callA, 'innovation', 'funded');

    $result = app(ReportService::class)->runReport('custom_builder', [
        'subject' => 'proposals',
        'dimensions' => ['category'],
        'metrics' => ['count', 'funded_count', 'rejected_count'],
    ]);

    expect($result['subject'])->toBe('proposals')
        ->and($result['dimensions'])->toBe(['category'])
        ->and($result['metrics'])->toBe(['count', 'funded_count', 'rejected_count']);

    $research = collect($result['rows'])->firstWhere('category', 'research');
    expect((int) $research['count'])->toBe(2)
        ->and((int) $research['funded_count'])->toBe(1)
        ->and((int) $research['rejected_count'])->toBe(1);
});

test('custom_builder rejects a dimension or metric not in the subject whitelist', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    rpt_proposal($collegeA, $deptA, $callA);

    $result = app(ReportService::class)->runReport('custom_builder', [
        'subject' => 'proposals',
        'dimensions' => ['college', 'department_id'], // department_id is not whitelisted
        'metrics' => ['count', 'total_amount'], // total_amount is not whitelisted
    ]);

    expect($result['dimensions'])->toBe(['college'])
        ->and($result['metrics'])->toBe(['count']);
});

test('custom_builder throws for an unknown subject', function () {
    expect(fn () => app(ReportService::class)->runReport('custom_builder', ['subject' => 'not_a_real_subject']))
        ->toThrow(InvalidArgumentException::class);
});

test('custom_builder defaults to a plain count when no metrics are chosen', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    rpt_proposal($collegeA, $deptA, $callA);
    rpt_proposal($collegeA, $deptA, $callA);

    $result = app(ReportService::class)->runReport('custom_builder', [
        'subject' => 'proposals',
        'dimensions' => [],
        'metrics' => [],
    ]);

    expect($result['metrics'])->toBe(['count']);
    expect((int) $result['rows'][0]['count'])->toBe(2);
});

test('college officer using the custom builder via the API only sees their own college', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RE'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'D', 'code' => 'RDE'.rand(10, 99)]);

    rpt_proposal($collegeA, $deptA, $callA);
    rpt_proposal($collegeB, $deptB, $callA);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');

    $response = $this->actingAs($officerA, 'sanctum')->postJson('/api/v1/reports/generate', [
        'type' => 'custom_builder',
        'filters' => [
            'subject' => 'proposals',
            'dimensions' => ['college'],
            'metrics' => ['count'],
            'college_id' => $collegeB->id, // attempting to spoof another college
        ],
    ]);

    $response->assertOk();
    $names = collect($response->json('data.result.rows'))->pluck('college');
    expect($names)->toContain($collegeA->name)
        ->not->toContain($collegeB->name);
});

// ─── Excel export ────────────────────────────────────────────────────────────

test('a ready snapshot can be exported to excel', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    rpt_proposal($college, $dept, $call, 'research', 'submitted');

    $snapshot = app(ReportService::class)->generate('proposal_count_by_category', [], $central);
    expect($snapshot->status)->toBe('ready');

    $response = $this->actingAs($central, 'sanctum')->get("/api/v1/reports/{$snapshot->id}/export");

    $response->assertOk();
    $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('a custom_builder snapshot can be exported to excel', function () {
    [$college, $dept, $central, $call] = rpt_makeBase();
    rpt_proposal($college, $dept, $call, 'research', 'funded');

    $snapshot = app(ReportService::class)->generate('custom_builder', [
        'subject' => 'proposals',
        'dimensions' => ['category'],
        'metrics' => ['count'],
    ], $central);
    expect($snapshot->status)->toBe('ready');

    $response = $this->actingAs($central, 'sanctum')->get("/api/v1/reports/{$snapshot->id}/export");

    $response->assertOk();
    $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('a user cannot export another user\'s report snapshot unless admin-tier', function () {
    [$collegeA, $deptA, $central, $callA] = rpt_makeBase();
    $collegeB = College::create(['name' => 'Rpt College B '.rand(), 'code' => 'RF'.rand(10, 99)]);

    rpt_proposal($collegeA, $deptA, $callA);

    $officerA = User::factory()->create(['college_id' => $collegeA->id]);
    $officerA->assignRole('college_officer');
    $officerB = User::factory()->create(['college_id' => $collegeB->id]);
    $officerB->assignRole('college_officer');

    $snapshot = app(ReportService::class)->generate('proposal_count_by_category', [], $officerA);

    $this->actingAs($officerB, 'sanctum')
        ->get("/api/v1/reports/{$snapshot->id}/export")
        ->assertForbidden();

    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $this->actingAs($central, 'sanctum')
        ->get("/api/v1/reports/{$snapshot->id}/export")
        ->assertOk();
});

test('a snapshot that is not ready cannot be exported', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $snapshot = app(ReportService::class)->generate('review_progress_pipeline', [
        'date_from' => now()->subMonths(5)->toDateString(),
        'date_to' => now()->toDateString(),
    ], $central);
    expect($snapshot->status)->toBe('processing');

    $this->actingAs($central, 'sanctum')
        ->get("/api/v1/reports/{$snapshot->id}/export")
        ->assertStatus(422);
});
