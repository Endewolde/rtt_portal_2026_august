<?php

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Queue::fake();
});

function reminder_makeStructure(int $daysUntilDeadline, string $status = 'draft'): array
{
    $college = College::create(['name' => 'Engineering', 'code' => 'ENG-'.rand(100, 999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'CS', 'code' => 'CS-'.rand(100, 999)]);

    $pi = User::factory()->create(['email' => 'pi'.rand().'@test.com']);
    $pi->assignRole('pi');

    $coI = User::factory()->create(['email' => 'coi'.rand().'@test.com']);
    $coI->assignRole('pi');

    $call = ProposalCall::create([
        'academic_year' => '2025/2026',
        'category' => 'research',
        'title' => 'Test Call',
        'slug' => 'test-call-'.rand(1000, 9999),
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays($daysUntilDeadline)->toDateString(),
        'status' => 'active',
        'created_by' => $pi->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'TRK-'.rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'Test Proposal',
        'status' => $status,
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2025/2026',
        'created_by' => $pi->id,
    ]);

    ProposalMember::create([
        'proposal_id' => $proposal->id,
        'user_id' => $coI->id,
        'role' => 'co_investigator',
        'status' => 'active',
        'contribution_percentage' => 50,
        'joined_at' => now(),
    ]);

    return compact('pi', 'coI', 'proposal', 'call');
}

test('sends reminders to PI and co-investigator for draft proposal due in 7 days', function () {
    ['pi' => $pi, 'coI' => $coI] = reminder_makeStructure(7);

    $this->artisan('rtt:deadline-reminders')->assertSuccessful();

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $pi->id && $job->event === 'deadline_reminder'
    );

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $coI->id && $job->event === 'deadline_reminder'
    );
});

test('sends reminders for 1-day, 3-day, and 7-day deadlines', function () {
    reminder_makeStructure(1);
    reminder_makeStructure(3);
    reminder_makeStructure(7);

    $this->artisan('rtt:deadline-reminders')->assertSuccessful();

    Queue::assertPushed(SendEmailNotificationJob::class, 6); // 2 recipients × 3 deadlines
});

test('does not send reminder for submitted proposals', function () {
    reminder_makeStructure(7, 'submitted');

    $this->artisan('rtt:deadline-reminders')->assertSuccessful();

    Queue::assertNotPushed(SendEmailNotificationJob::class);
});

test('does not send duplicate reminders when PI has multiple draft proposals in same call', function () {
    ['pi' => $pi, 'call' => $call, 'proposal' => $proposal] = reminder_makeStructure(7);

    Proposal::create([
        'tracker_number' => 'TRK-'.rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'Second Draft',
        'status' => 'draft',
        'pi_user_id' => $pi->id,
        'college_id' => $proposal->college_id,
        'department_id' => $proposal->department_id,
        'academic_year' => '2025/2026',
        'created_by' => $pi->id,
    ]);

    $this->artisan('rtt:deadline-reminders')->assertSuccessful();

    $piJobCount = collect(Queue::pushedJobs()[SendEmailNotificationJob::class] ?? [])
        ->filter(fn ($j) => $j['job']->recipient->id === $pi->id)
        ->count();

    expect($piJobCount)->toBe(1);
});

test('stores in-app notification for each reminded user', function () {
    reminder_makeStructure(3);

    $this->artisan('rtt:deadline-reminders')->assertSuccessful();

    Queue::assertPushed(StoreInAppNotificationJob::class, 2); // PI + co-investigator
});
