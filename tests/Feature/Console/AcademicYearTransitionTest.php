<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\AppSetting;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Bus::fake();
});

function ayt_base(): array
{
    $superAdmin = User::factory()->create();
    $superAdmin->assignRole('super_admin');

    $college = College::create(['name' => 'AYT College '.rand(), 'code' => 'AYT'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'AYTD'.rand(10000, 99999)]);

    return [$superAdmin, $college, $dept];
}

test('closes active proposal calls and marks them not open', function () {
    [$superAdmin, $college] = ayt_base();

    $call = ProposalCall::create([
        'academic_year' => '2025/26', 'category' => 'research',
        'title' => 'Active Call', 'slug' => 'ayt-'.rand(10000, 99999),
        'start_date' => now()->subMonths(2)->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $superAdmin->id,
    ]);

    $alreadyClosedCall = ProposalCall::create([
        'academic_year' => '2024/25', 'category' => 'research',
        'title' => 'Already Closed', 'slug' => 'ayt-closed-'.rand(10000, 99999),
        'start_date' => now()->subYear()->toDateString(), 'end_date' => now()->subMonths(6)->toDateString(),
        'status' => 'closed', 'is_open' => false, 'created_by' => $superAdmin->id,
    ]);

    Artisan::call('academic-year:transition', ['new_year' => '2026/27']);

    expect($call->fresh()->status)->toBe('closed')
        ->and($call->fresh()->is_open)->toBeFalse()
        ->and($alreadyClosedCall->fresh()->status)->toBe('closed');
});

test('dry-run leaves calls and the academic year setting untouched', function () {
    [$superAdmin, $college] = ayt_base();

    $call = ProposalCall::create([
        'academic_year' => '2025/26', 'category' => 'research',
        'title' => 'Active Call', 'slug' => 'ayt-dry-'.rand(10000, 99999),
        'start_date' => now()->subMonths(2)->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $superAdmin->id,
    ]);

    AppSetting::updateOrCreate(['key' => 'current_academic_year'], ['value' => '2025/26']);

    Artisan::call('academic-year:transition', ['new_year' => '2026/27', '--dry-run' => true]);

    expect($call->fresh()->status)->toBe('active')
        ->and($call->fresh()->is_open)->toBeTrue()
        ->and(AppSetting::where('key', 'current_academic_year')->value('value'))->toBe('2025/26');
});

test('updates the current_academic_year setting when not a dry run', function () {
    [$superAdmin, $college] = ayt_base();
    AppSetting::updateOrCreate(['key' => 'current_academic_year'], ['value' => '2025/26']);

    Artisan::call('academic-year:transition', ['new_year' => '2026/27']);

    expect(AppSetting::where('key', 'current_academic_year')->value('value'))->toBe('2026/27');
});

test('notifies PIs of every non-terminal, non-draft proposal but not a completed-and-archived or draft one', function () {
    [$superAdmin, $college, $dept] = ayt_base();

    $call = ProposalCall::create([
        'academic_year' => '2025/26', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ayt-notify-'.rand(10000, 99999),
        'start_date' => now()->subMonths(2)->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $superAdmin->id,
    ]);

    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    $openProposal = Proposal::create([
        'tracker_number' => 'AYT-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Still under review', 'status' => 'under_blind_review',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2025/26', 'created_by' => $pi->id,
    ]);

    $draftProposal = Proposal::create([
        'tracker_number' => 'AYT-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Never submitted', 'status' => 'draft',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2025/26', 'created_by' => $pi->id,
    ]);

    $archivedProposal = Proposal::create([
        'tracker_number' => 'AYT-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Long done', 'status' => 'archived',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2023/24', 'created_by' => $pi->id,
    ]);

    Artisan::call('academic-year:transition', ['new_year' => '2026/27']);

    Bus::assertDispatched(SendEmailNotificationJob::class, 1);
    Bus::assertDispatched(SendEmailNotificationJob::class, fn ($job) => $job->recipient->is($pi));
});
