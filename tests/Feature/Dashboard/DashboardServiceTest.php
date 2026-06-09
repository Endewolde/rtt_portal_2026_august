<?php

use App\Models\College;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Services\DashboardService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    Cache::flush();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dash_makeUser(string $role, array $attrs = []): User
{
    $user = User::factory()->create($attrs);
    $user->assignRole($role);
    NotificationPreference::firstOrCreate(['user_id' => $user->id], [
        'email_enabled' => false, 'telegram_enabled' => false, 'inapp_enabled' => true,
    ]);

    return $user;
}

function dash_makeCollegeUser(string $role): User
{
    $college = College::create(['name' => 'Dash C '.rand(), 'code' => 'DC'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'DD'.rand(10, 99)]);

    return dash_makeUser($role, ['college_id' => $college->id, 'department_id' => $dept->id]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('super admin gets proposals_by_status, pending_tasks, budget_utilization_summary, trend_chart', function () {
    $admin   = dash_makeUser('super_admin');
    $widgets = app(DashboardService::class)->getWidgets($admin);

    expect($widgets)->toHaveKey('proposals_by_status')
        ->toHaveKey('pending_tasks')
        ->toHaveKey('budget_utilization_summary')
        ->toHaveKey('proposal_trend_chart');
});

test('reviewer gets reviewer_queue widget', function () {
    $reviewer = dash_makeUser('reviewer');
    $widgets  = app(DashboardService::class)->getWidgets($reviewer);

    expect($widgets)->toHaveKey('reviewer_queue');
});

test('PI gets my_proposals widget', function () {
    $pi      = dash_makeCollegeUser('pi');
    $widgets = app(DashboardService::class)->getWidgets($pi);

    expect($widgets)->toHaveKey('my_proposals');
});

test('finance gets budget_utilization_summary widget', function () {
    $finance = dash_makeUser('finance');
    $widgets = app(DashboardService::class)->getWidgets($finance);

    expect($widgets)->toHaveKey('budget_utilization_summary');
});

test('college admin does NOT get budget_utilization_summary widget', function () {
    $admin   = dash_makeCollegeUser('college_admin');
    $widgets = app(DashboardService::class)->getWidgets($admin);

    expect($widgets)->not->toHaveKey('budget_utilization_summary');
});

test('PI does NOT get trend_chart widget', function () {
    $pi      = dash_makeCollegeUser('pi');
    $widgets = app(DashboardService::class)->getWidgets($pi);

    expect($widgets)->not->toHaveKey('proposal_trend_chart');
});

test('dashboard result is cached on second call', function () {
    $admin = dash_makeUser('super_admin');

    $queryCount = 0;
    DB::listen(function () use (&$queryCount) {
        $queryCount++;
    });

    app(DashboardService::class)->getWidgets($admin);
    $firstCount = $queryCount;

    $queryCount = 0;
    app(DashboardService::class)->getWidgets($admin);
    $secondCount = $queryCount;

    expect($secondCount)->toBeLessThan($firstCount);
});

test('cache invalidated after invalidate() called', function () {
    $admin   = dash_makeUser('super_admin');
    $service = app(DashboardService::class);

    $service->getWidgets($admin);
    expect(Cache::has("dashboard:{$admin->id}"))->toBeTrue();

    $service->invalidate($admin->id);
    expect(Cache::has("dashboard:{$admin->id}"))->toBeFalse();
});
