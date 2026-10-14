<?php

use App\Exceptions\ReminderCooldownException;
use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewReminder;
use App\Models\User;
use App\Services\ReviewReminderService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new ThresholdSettingSeeder)->run();
});

function rr_makeAssignment(string $dueDate, string $status = 'pending'): ReviewAssignment
{
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $reviewer = User::factory()->create();
    $reviewer->assignRole('reviewer');

    $college = College::create(['name' => 'RR College '.rand(), 'code' => 'RR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RRD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'RR Call', 'slug' => 'rr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);
    $proposal = Proposal::create([
        'tracker_number' => 'RR-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'RR Proposal', 'status' => 'under_blind_review',
        'pi_user_id' => $reviewer->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $admin->id,
    ]);
    $type = EvaluationType::create([
        'name' => 'blind_review_rr_'.rand(1000, 9999),
        'label' => 'Blind Review', 'proposal_category' => 'research', 'is_active' => true,
    ]);

    return ReviewAssignment::create([
        'proposal_id' => $proposal->id,
        'reviewer_id' => $reviewer->id,
        'evaluation_type_id' => $type->id,
        'assigned_by' => $admin->id,
        'status' => $status,
        'assigned_at' => now(),
        'due_date' => $dueDate,
    ]);
}

test('due_date is cast to a Carbon date instance', function () {
    $assignment = rr_makeAssignment(now()->addDays(3)->toDateString());

    expect($assignment->due_date)->toBeInstanceOf(Carbon\Carbon::class);
});

test('sendReminder logs a review_reminders row and does not error', function () {
    $assignment = rr_makeAssignment(now()->addDays(3)->toDateString());

    app(ReviewReminderService::class)->sendReminder($assignment, '3_days_before');

    expect(ReviewReminder::where('review_assignment_id', $assignment->id)->where('type', '3_days_before')->exists())->toBeTrue();
});

test('runScheduledReminders sends a reminder for each configured before-deadline tier', function () {
    $sevenDay = rr_makeAssignment(now()->addDays(7)->toDateString());
    $threeDay = rr_makeAssignment(now()->addDays(3)->toDateString());
    $oneDay = rr_makeAssignment(now()->addDays(1)->toDateString());
    $today = rr_makeAssignment(now()->toDateString());
    $untouched = rr_makeAssignment(now()->addDays(2)->toDateString());

    $summary = app(ReviewReminderService::class)->runScheduledReminders();

    expect($summary['sent'])->toBe(4)
        ->and(ReviewReminder::where('review_assignment_id', $sevenDay->id)->where('type', '7_days_before')->exists())->toBeTrue()
        ->and(ReviewReminder::where('review_assignment_id', $threeDay->id)->where('type', '3_days_before')->exists())->toBeTrue()
        ->and(ReviewReminder::where('review_assignment_id', $oneDay->id)->where('type', '1_day_before')->exists())->toBeTrue()
        ->and(ReviewReminder::where('review_assignment_id', $today->id)->where('type', 'due_today')->exists())->toBeTrue()
        ->and(ReviewReminder::where('review_assignment_id', $untouched->id)->exists())->toBeFalse();
});

test('runScheduledReminders is idempotent within the same day', function () {
    rr_makeAssignment(now()->addDays(3)->toDateString());

    $service = app(ReviewReminderService::class);
    $first = $service->runScheduledReminders();
    $second = $service->runScheduledReminders();

    expect($first['sent'])->toBe(1)
        ->and($second['sent'])->toBe(0)
        ->and($second['skipped'])->toBe(1)
        ->and(ReviewReminder::count())->toBe(1);
});

test('overdue assignments are reminded and then respect the configured repeat interval', function () {
    $assignment = rr_makeAssignment(now()->subDays(5)->toDateString());

    $service = app(ReviewReminderService::class);
    $first = $service->runScheduledReminders();
    expect($first['sent'])->toBe(1)
        ->and(ReviewReminder::where('review_assignment_id', $assignment->id)->where('type', 'overdue')->count())->toBe(1);

    // Running again immediately must NOT send a second overdue reminder — the
    // default overdue_reminder_interval_days threshold (3) hasn't elapsed yet.
    $second = $service->runScheduledReminders();
    expect($second['sent'])->toBe(0)
        ->and(ReviewReminder::where('review_assignment_id', $assignment->id)->where('type', 'overdue')->count())->toBe(1);

    // Backdate the reminder past the interval and confirm it fires again.
    ReviewReminder::where('review_assignment_id', $assignment->id)->update(['sent_at' => now()->subDays(4)]);
    $third = $service->runScheduledReminders();
    expect($third['sent'])->toBe(1)
        ->and(ReviewReminder::where('review_assignment_id', $assignment->id)->where('type', 'overdue')->count())->toBe(2);
});

test('a manual reminder rejects a second click within the cooldown window', function () {
    $assignment = rr_makeAssignment(now()->addDays(1)->toDateString());
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');

    $service = app(ReviewReminderService::class);
    $service->sendReminder($assignment, 'manual', $admin);

    $service->sendReminder($assignment, 'manual', $admin);
})->throws(ReminderCooldownException::class);

test('assignments no longer active (submitted/declined) are excluded from the schedule', function () {
    $submitted = rr_makeAssignment(now()->toDateString(), 'submitted');
    $declined = rr_makeAssignment(now()->toDateString(), 'declined');

    $summary = app(ReviewReminderService::class)->runScheduledReminders();

    expect($summary['sent'])->toBe(0)
        ->and(ReviewReminder::where('review_assignment_id', $submitted->id)->exists())->toBeFalse()
        ->and(ReviewReminder::where('review_assignment_id', $declined->id)->exists())->toBeFalse();
});
