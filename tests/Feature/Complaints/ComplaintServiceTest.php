<?php

use App\Exceptions\ComplaintAlreadyFiledException;
use App\Exceptions\UnauthorizedResolutionException;
use App\Models\College;
use App\Models\Complaint;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\ComplaintService;
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

function comp_makeBase(): array
{
    $college = College::create(['name' => 'Comp College '.rand(), 'code' => 'CP'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CD'.rand(10, 99)]);

    $central       = User::factory()->create(); $central->assignRole('central_officer');
    $collegeAdmin  = User::factory()->create(['college_id' => $college->id]); $collegeAdmin->assignRole('college_officer');
    $pi            = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]); $pi->assignRole('pi');

    foreach ([$central, $collegeAdmin, $pi] as $u) {
        NotificationPreference::firstOrCreate(['user_id' => $u->id], [
            'email_enabled' => true, 'telegram_enabled' => false, 'inapp_enabled' => true,
        ]);
    }

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'comp-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'Complaint Proposal', 'status' => 'under_review',
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $pi, $central, $collegeAdmin, $college];
}

function comp_description(): string
{
    return 'This is a detailed complaint description that is longer than fifty characters for testing purposes.';
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('PI can file complaint at blind_review stage', function () {
    [$proposal, $pi, $central, $collegeAdmin] = comp_makeBase();

    $complaint = app(ComplaintService::class)->file($proposal, $pi, 'blind_review', comp_description());

    expect($complaint)->toBeInstanceOf(Complaint::class)
        ->and($complaint->stage)->toBe('blind_review')
        ->and($complaint->status)->toBe('open')
        ->and($complaint->complainant_id)->toBe($pi->id);
});

test('blind_review complaint assigned to College Admin of proposal college', function () {
    [$proposal, $pi, $central, $collegeAdmin] = comp_makeBase();

    $complaint = app(ComplaintService::class)->file($proposal, $pi, 'blind_review', comp_description());

    expect($complaint->assigned_to)->toBe($collegeAdmin->id);
});

test('final_decision complaint assigned to Central Office — NOT College Admin', function () {
    [$proposal, $pi, $central, $collegeAdmin] = comp_makeBase();

    $complaint = app(ComplaintService::class)->file($proposal, $pi, 'final_decision', comp_description());

    expect($complaint->assigned_to)->toBe($central->id);
    expect($complaint->assigned_to)->not->toBe($collegeAdmin->id);
});

test('duplicate open complaint for same proposal and stage throws ComplaintAlreadyFiledException', function () {
    [$proposal, $pi] = comp_makeBase();
    $service = app(ComplaintService::class);

    $service->file($proposal, $pi, 'blind_review', comp_description());

    expect(fn () => $service->file($proposal, $pi, 'blind_review', comp_description()))
        ->toThrow(ComplaintAlreadyFiledException::class);
});

test('description shorter than 50 characters throws InvalidArgumentException', function () {
    [$proposal, $pi] = comp_makeBase();

    expect(fn () => app(ComplaintService::class)->file($proposal, $pi, 'blind_review', 'Too short'))
        ->toThrow(\InvalidArgumentException::class, '50 characters');
});

test('College Admin throws UnauthorizedResolutionException when resolving final_decision complaint', function () {
    [$proposal, $pi, $central, $collegeAdmin] = comp_makeBase();

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'final_decision',
        'description'    => comp_description(),
        'status'         => 'open',
        'assigned_to'    => $central->id,
    ]);

    expect(fn () => app(ComplaintService::class)->respond($complaint, $collegeAdmin, 'My response', 'resolved'))
        ->toThrow(UnauthorizedResolutionException::class);
});

test('College Admin throws UnauthorizedResolutionException when resolving validation complaint', function () {
    [$proposal, $pi, $central, $collegeAdmin] = comp_makeBase();

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'validation',
        'description'    => comp_description(),
        'status'         => 'open',
        'assigned_to'    => $central->id,
    ]);

    expect(fn () => app(ComplaintService::class)->respond($complaint, $collegeAdmin, 'My response', 'resolved'))
        ->toThrow(UnauthorizedResolutionException::class);
});

test('College Admin CAN resolve blind_review complaint', function () {
    [$proposal, $pi, $central, $collegeAdmin] = comp_makeBase();

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'blind_review',
        'level'          => 'college',
        'description'    => comp_description(),
        'status'         => 'open',
        'assigned_to'    => $collegeAdmin->id,
    ]);

    $resolved = app(ComplaintService::class)->respond($complaint, $collegeAdmin, 'Issue reviewed', 'resolved');

    expect($resolved->status)->toBe('resolved')
        ->and($resolved->resolved_by)->toBe($collegeAdmin->id);
});

test('College Admin CAN resolve open_defence complaint', function () {
    [$proposal, $pi, $central, $collegeAdmin] = comp_makeBase();

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'open_defence',
        'level'          => 'college',
        'description'    => comp_description(),
        'status'         => 'open',
        'assigned_to'    => $collegeAdmin->id,
    ]);

    $resolved = app(ComplaintService::class)->respond($complaint, $collegeAdmin, 'Reviewed carefully', 'dismissed');

    expect($resolved->status)->toBe('dismissed');
});

test('complaint response dispatches notification to PI', function () {
    [$proposal, $pi, $central, $collegeAdmin] = comp_makeBase();
    Queue::fake(\App\Jobs\StoreInAppNotificationJob::class);

    $complaint = Complaint::create([
        'proposal_id'    => $proposal->id,
        'complainant_id' => $pi->id,
        'stage'          => 'blind_review',
        'level'          => 'college',
        'description'    => comp_description(),
        'status'         => 'open',
    ]);

    app(ComplaintService::class)->respond($complaint, $collegeAdmin, 'We reviewed your complaint', 'resolved');

    Queue::assertPushed(\App\Jobs\StoreInAppNotificationJob::class,
        fn ($job) => $job->userId === $pi->id && $job->event === 'complaint_response'
    );
});
