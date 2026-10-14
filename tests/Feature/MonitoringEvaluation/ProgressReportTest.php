<?php

use App\Models\BudgetMilestone;
use App\Models\College;
use App\Models\Department;
use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\WorkflowService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    Storage::fake('private');

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->college = College::create(['name' => 'C'.rand(), 'code' => 'PR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'PRD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'pr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->pi = User::factory()->create();
    $this->pi->assignRole('staff');
    $this->officer = User::factory()->create(['college_id' => $this->college->id]);
    $this->officer->assignRole('college_officer');

    $this->proposal = Proposal::create([
        'tracker_number' => 'PR-1', 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'P',
        'status' => 'accepted', 'pi_user_id' => $this->pi->id, 'college_id' => $this->college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $this->pi->id, 'duration_months' => 12,
    ]);
});

function pr_fund(object $ctx, string $fundedOn = '2026-01-01'): void
{
    Carbon::setTestNow($fundedOn);
    app(WorkflowService::class)->transition($ctx->proposal, 'fund', $ctx->central);
    Carbon::setTestNow();
}

test('funding a 12-month project creates four quarterly reports, the last one final', function () {
    pr_fund($this);

    $reports = ProgressReport::where('proposal_id', $this->proposal->id)->orderBy('period_number')->get();

    expect($reports)->toHaveCount(4)
        ->and($reports[0]->period_start->toDateString())->toBe('2026-01-01')
        ->and($reports[0]->period_end->toDateString())->toBe('2026-03-31')
        ->and($reports[0]->due_date->toDateString())->toBe('2026-04-14')
        ->and($reports[3]->is_final)->toBeTrue()
        ->and($reports[3]->period_end->toDateString())->toBe('2026-12-31');
});

test('the PI submits a report with milestone updates and an attachment; officers are notified', function () {
    pr_fund($this);
    $milestone = BudgetMilestone::create(['proposal_id' => $this->proposal->id, 'title' => 'Fieldwork', 'amount' => 1000, 'due_date' => '2026-03-01', 'status' => 'pending', 'sort_order' => 1]);
    $report = ProgressReport::where('proposal_id', $this->proposal->id)->where('period_number', 1)->first();
    Carbon::setTestNow('2026-04-05');

    $this->actingAs($this->pi, 'sanctum')
        ->post("/api/v1/progress-reports/{$report->id}/submit", [
            'summary' => 'Completed fieldwork in three kebeles and digitised all survey forms.',
            'percent_complete' => 30,
            'budget_spent' => 45000,
            'milestone_updates' => [['milestone_id' => $milestone->id, 'status' => 'completed', 'note' => 'Done early']],
            'attachment' => UploadedFile::fake()->create('q1.pdf', 200, 'application/pdf'),
        ], ['Accept' => 'application/json'])
        ->assertOk();

    $report->refresh();
    expect($report->status)->toBe('submitted')
        ->and($report->percent_complete)->toBe(30)
        ->and($report->milestone_updates[0]['title'])->toBe('Fieldwork')
        ->and($milestone->fresh()->status)->toBe('completed')
        ->and(Storage::disk('private')->exists($report->attachment_path))->toBeTrue()
        ->and(DB::table('notifications')->where('notifiable_id', $this->officer->id)->where('type', 'progress_report_submitted')->exists())->toBeTrue();
    Carbon::setTestNow();
});

test('a report for a period that has not started cannot be submitted', function () {
    pr_fund($this);
    $later = ProgressReport::where('proposal_id', $this->proposal->id)->where('period_number', 4)->first();
    Carbon::setTestNow('2026-02-01');

    $this->actingAs($this->pi, 'sanctum')
        ->postJson("/api/v1/progress-reports/{$later->id}/submit", ['summary' => str_repeat('Work done this period. ', 3), 'percent_complete' => 10])
        ->assertStatus(422)
        ->assertJsonPath('message', 'This reporting period has not started yet.');
    Carbon::setTestNow();
});

test('the college officer can send a report back, and the PI resubmits', function () {
    pr_fund($this);
    $report = ProgressReport::where('proposal_id', $this->proposal->id)->where('period_number', 1)->first();
    $report->update(['status' => 'submitted', 'summary' => 'x', 'percent_complete' => 20, 'submitted_at' => now(), 'submitted_by' => $this->pi->id]);

    $this->actingAs($this->officer, 'sanctum')
        ->postJson("/api/v1/progress-reports/{$report->id}/review", ['decision' => 'revision_requested', 'notes' => 'Please add the survey response rate.'])
        ->assertOk();

    expect($report->fresh()->status)->toBe('revision_requested')
        ->and(DB::table('notifications')->where('notifiable_id', $this->pi->id)->where('type', 'progress_report_reviewed')->exists())->toBeTrue();

    $this->actingAs($this->pi, 'sanctum')
        ->postJson("/api/v1/progress-reports/{$report->id}/submit", ['summary' => 'Response rate was 87% across all three kebeles surveyed.', 'percent_complete' => 25])
        ->assertOk();
    expect($report->fresh()->status)->toBe('submitted');
});

test('other people cannot submit or review', function () {
    pr_fund($this);
    $report = ProgressReport::where('proposal_id', $this->proposal->id)->where('period_number', 1)->first();
    $stranger = User::factory()->create();
    $stranger->assignRole('staff');

    $this->actingAs($stranger, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/progress-reports")->assertForbidden();
    $this->actingAs($this->pi, 'sanctum')
        ->postJson("/api/v1/progress-reports/{$report->id}/review", ['decision' => 'accepted'])
        ->assertForbidden();
});

test('the daily sweep reminds PIs of reports due soon and overdue, once each', function () {
    pr_fund($this);
    Carbon::setTestNow('2026-04-10'); // report 1 ended Mar 31, due Apr 14 → due soon

    Artisan::call('rtt:progress-reports');
    Artisan::call('rtt:progress-reports');
    expect(DB::table('notifications')->where('notifiable_id', $this->pi->id)->where('type', 'progress_report_due')->count())->toBe(1);

    Carbon::setTestNow('2026-04-20'); // now overdue
    Artisan::call('rtt:progress-reports');
    expect(DB::table('notifications')->where('notifiable_id', $this->pi->id)->where('type', 'progress_report_overdue')->count())->toBe(1);

    $this->actingAs($this->officer, 'sanctum')->getJson('/api/v1/progress-reports')
        ->assertOk()
        ->assertJsonCount(1, 'data.overdue');
    Carbon::setTestNow();
});
