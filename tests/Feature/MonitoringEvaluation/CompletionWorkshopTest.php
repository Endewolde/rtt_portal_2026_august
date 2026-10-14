<?php

use App\Jobs\ArchiveProposalJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Models\College;
use App\Models\CompletionWorkshop;
use App\Models\Department;
use App\Models\FormTemplate;
use App\Models\MidtermEvaluation;
use App\Models\NotificationPreference;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\RepositoryRecord;
use App\Models\User;
use App\Services\CompletionWorkshopService;
use Database\Seeders\FormTemplateSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new FormTemplateSeeder)->run();
    Queue::fake();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cw_makeBase(): array
{
    $college = College::create(['name' => 'CW College '.rand(), 'code' => 'CW'.rand(10, 99)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CW'.rand(10, 99)]);

    $central = User::factory()->create();
    $central->assignRole('central_officer');
    $collegeAdmin = User::factory()->create(['college_id' => $college->id]);
    $collegeAdmin->assignRole('college_officer');
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    foreach ([$central, $collegeAdmin, $pi] as $u) {
        NotificationPreference::firstOrCreate(['user_id' => $u->id], [
            'email_enabled' => false, 'telegram_enabled' => false, 'inapp_enabled' => true,
        ]);
    }

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'cw-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'CW Proposal', 'status' => 'midterm_evaluation',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    // Settlement verification and completion workshops require a scored Mid-Term M&E
    // with a "continue" recommendation.
    MidtermEvaluation::create([
        'proposal_id' => $proposal->id, 'evaluation_date' => now()->subMonth()->toDateString(),
        'status' => 'scored', 'scheduled_by' => $collegeAdmin->id, 'progress_score' => 80,
        'recommendation' => 'continue', 'scored_by' => $collegeAdmin->id, 'scored_at' => now()->subMonth(),
    ]);

    // ...and the final (Phase II) settlement verified by Finance.
    $roundTwo = BudgetRequest::create([
        'proposal_id' => $proposal->id, 'form_template_id' => FormTemplate::where('name', 'Research Budget Request')->value('id'),
        'requested_by' => $pi->id, 'total_amount' => 50000, 'status' => 'settled', 'funding_round' => 2,
        'all_signatures_complete' => true, 'submitted_at' => now()->subWeeks(3),
    ]);
    BudgetSettlement::create([
        'budget_request_id' => $roundTwo->id, 'submitted_by' => $pi->id, 'status' => 'finance_verified',
        'total_spent' => 50000, 'unspent_amount' => 0,
        'college_verified_by' => $collegeAdmin->id, 'college_verified_at' => now()->subWeeks(2),
        'finance_verified_by' => $central->id, 'finance_verified_at' => now()->subWeek(),
    ]);

    return [$proposal, $pi, $central, $collegeAdmin];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('can schedule completion workshop', function () {
    [$proposal, $pi, $central] = cw_makeBase();

    $workshop = app(CompletionWorkshopService::class)->schedule($proposal, [
        'date' => now()->addMonths(2)->toDateString(),
        'time' => '09:00:00',
        'venue' => 'Main Conference Hall A',
    ], $central);

    expect($workshop)->toBeInstanceOf(CompletionWorkshop::class)
        ->and($workshop->status)->toBe('scheduled')
        ->and($workshop->venue)->toBe('Main Conference Hall A');
});

test('can store evidence and remarks', function () {
    [$proposal, $pi, $central] = cw_makeBase();
    $service = app(CompletionWorkshopService::class);

    $workshop = $service->schedule($proposal, [
        'date' => now()->addMonths(2)->toDateString(), 'time' => '09:00:00', 'venue' => 'Hall B',
    ], $central);

    $updated = $service->storeEvidence($workshop, [
        'presentation_files' => ['slides.pdf'],
        'photos' => ['photo1.jpg', 'photo2.jpg'],
        'videos' => ['video1.mp4'],
        'final_report_path' => 'reports/final.pdf',
    ], 'Strong presentation with clear outcomes.');

    expect($updated->evaluator_remarks)->toBe('Strong presentation with clear outcomes.')
        ->and($updated->presentation_files)->toBe(['slides.pdf'])
        ->and($updated->photos)->toHaveCount(2);
});

test('finalizing workshop transitions proposal to completed', function () {
    [$proposal, $pi, $central, $collegeAdmin] = cw_makeBase();
    $service = app(CompletionWorkshopService::class);

    $workshop = $service->schedule($proposal, [
        'date' => now()->addMonths(2)->toDateString(), 'time' => '10:00:00', 'venue' => 'Hall C',
    ], $central);

    $completed = $service->finalizeWorkshop($workshop, 88.0, $collegeAdmin);

    expect($completed->status)->toBe('completed');
});

test('repository record auto-created when proposal moves to completed', function () {
    [$proposal, $pi, $central, $collegeAdmin] = cw_makeBase();
    $service = app(CompletionWorkshopService::class);

    $workshop = $service->schedule($proposal, [
        'date' => now()->addMonths(2)->toDateString(), 'time' => '10:00:00', 'venue' => 'Hall D',
    ], $central);

    $service->finalizeWorkshop($workshop, 90.0, $collegeAdmin);

    expect(RepositoryRecord::where('proposal_id', $proposal->id)->exists())->toBeTrue();
});

test('ArchiveProposalJob dispatched with delay after finalization', function () {
    [$proposal, $pi, $central, $collegeAdmin] = cw_makeBase();
    $service = app(CompletionWorkshopService::class);

    $workshop = $service->schedule($proposal, [
        'date' => now()->addMonths(2)->toDateString(), 'time' => '10:00:00', 'venue' => 'Hall E',
    ], $central);

    Queue::fake();
    $service->finalizeWorkshop($workshop, 85.0, $collegeAdmin);

    Queue::assertPushed(ArchiveProposalJob::class, fn ($job) => $job->proposalId === $proposal->id);
});

test('PI notified on completion', function () {
    [$proposal, $pi, $central, $collegeAdmin] = cw_makeBase();
    $service = app(CompletionWorkshopService::class);

    $workshop = $service->schedule($proposal, [
        'date' => now()->addMonths(2)->toDateString(), 'time' => '10:00:00', 'venue' => 'Hall F',
    ], $central);

    Queue::fake();
    $service->finalizeWorkshop($workshop, 92.0, $collegeAdmin);

    Queue::assertPushed(StoreInAppNotificationJob::class, fn ($job) => $job->userId === $pi->id && $job->event === 'proposal_completed'
    );
});
