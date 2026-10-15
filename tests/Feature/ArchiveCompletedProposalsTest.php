<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ResearchOutput;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\WorkflowGuards\CompletionChecklistGuard;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $this->pi = User::factory()->create();
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'ac-'.rand(10000, 99999),
        'start_date' => now()->subYear()->toDateString(), 'end_date' => now()->subMonths(11)->toDateString(),
        'status' => 'expired', 'is_open' => false, 'created_by' => $admin->id,
    ]);
    $this->completed = fn (int $daysAgo) => Proposal::create([
        'tracker_number' => 'RES-AC-'.rand(10000, 99999), 'proposal_call_id' => $call->id, 'pi_user_id' => $this->pi->id,
        'college_id' => $college->id, 'department_id' => $dept->id, 'title' => 'P', 'status' => 'completed',
        'category' => 'research', 'academic_year' => '2026', 'created_by' => $this->pi->id, 'status_entered_at' => now()->subDays($daysAgo),
    ]);
});

test('projects completed over 30 days ago are archived; recent ones are left', function () {
    $old = ($this->completed)(31);
    $recent = ($this->completed)(5);

    $this->artisan('proposals:archive-completed')->assertSuccessful();

    expect($old->fresh()->status)->toBe('archived')
        ->and($recent->fresh()->status)->toBe('completed');
});

test('with the completion checklist on, a project without outputs waits instead of breaking the sweep', function () {
    DB::table('workflow_transitions')
        ->join('workflow_actions', 'workflow_actions.id', '=', 'workflow_transitions.action_id')
        ->where('workflow_actions.name', 'archive')
        ->update(['guard_class' => CompletionChecklistGuard::class]);
    $noOutputs = ($this->completed)(40);
    $withOutput = ($this->completed)(40);
    ResearchOutput::create(['proposal_id' => $withOutput->id, 'output_type' => 'journal_article', 'title' => 'Paper', 'recorded_by' => $this->pi->id, 'status' => 'approved']);

    $this->artisan('proposals:archive-completed')->assertSuccessful();

    expect($noOutputs->fresh()->status)->toBe('completed')
        ->and($withOutput->fresh()->status)->toBe('archived');
});

test('general notifications are actually sent, not left waiting for a queue worker', function () {
    Bus::fake();

    app(NotificationService::class)->send('complaint_filed', $this->pi, ['message' => 'A complaint was filed.']);

    Bus::assertDispatchedSync(SendEmailNotificationJob::class);
});
