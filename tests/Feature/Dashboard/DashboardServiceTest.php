<?php

use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Services\DashboardService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
    $college = College::create(['name' => 'Dash C '.rand(), 'code' => 'DC'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'DD'.rand(10000, 99999)]);

    return dash_makeUser($role, ['college_id' => $college->id, 'department_id' => $dept->id]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('super admin gets proposals_by_status, pending_tasks, budget_utilization_summary, trend_chart', function () {
    $admin = dash_makeUser('super_admin');
    $widgets = app(DashboardService::class)->getWidgets($admin);

    expect($widgets)->toHaveKey('proposals_by_status')
        ->toHaveKey('pending_tasks')
        ->toHaveKey('budget_utilization_summary')
        ->toHaveKey('proposal_trend_chart');
});

test('a reviewer gets the common widgets but no admin-only ones', function () {
    // The dedicated reviewer_queue widget was retired — reviewers work from My Reviews.
    $reviewer = dash_makeUser('reviewer');
    $widgets = app(DashboardService::class)->getWidgets($reviewer);

    expect($widgets)->toHaveKey('pending_tasks')
        ->toHaveKey('recent_notifications')
        ->not->toHaveKey('proposal_trend_chart')
        ->not->toHaveKey('budget_utilization_summary');
});

test('PI gets my_proposals widget', function () {
    // Researchers who lead proposals hold the staff role.
    $pi = dash_makeCollegeUser('staff');
    $widgets = app(DashboardService::class)->getWidgets($pi);

    expect($widgets)->toHaveKey('my_proposals');
});

test('finance gets budget_utilization_summary widget', function () {
    $finance = dash_makeUser('finance_officer');
    $widgets = app(DashboardService::class)->getWidgets($finance);

    expect($widgets)->toHaveKey('budget_utilization_summary');
});

test('college admin does NOT get budget_utilization_summary widget', function () {
    $admin = dash_makeCollegeUser('college_officer');
    $widgets = app(DashboardService::class)->getWidgets($admin);

    expect($widgets)->not->toHaveKey('budget_utilization_summary');
});

test('PI does NOT get trend_chart widget', function () {
    $pi = dash_makeCollegeUser('pi');
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
    $admin = dash_makeUser('super_admin');
    $service = app(DashboardService::class);

    $service->getWidgets($admin);
    expect(Cache::has("dashboard:v2:{$admin->id}"))->toBeTrue();

    $service->invalidate($admin->id);
    expect(Cache::has("dashboard:v2:{$admin->id}"))->toBeFalse();
});

// ─── Each widget shows what the user oversees ────────────────────────────────

function dash_proposal(College $college, User $pi, string $status, string $category = 'research'): string
{
    $call = DB::table('proposal_calls')->value('id') ?? tap((string) Str::uuid(), fn ($id) => DB::table('proposal_calls')->insert([
        'id' => $id, 'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'dash-'.rand(),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active',
        'is_open' => true, 'created_by' => $pi->id, 'created_at' => now(), 'updated_at' => now(),
    ]));
    $id = (string) Str::uuid();
    DB::table('proposals')->insert([
        'id' => $id, 'tracker_number' => 'DSH-'.rand(100000, 999999), 'proposal_call_id' => $call, 'category' => $category,
        'title' => "Proposal {$status}", 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => DB::table('departments')->where('college_id', $college->id)->value('id'),
        'academic_year' => '2026-2027', 'created_by' => $pi->id, 'submitted_at' => $status === 'draft' ? null : now(),
        'created_at' => now(), 'updated_at' => now(),
    ]);

    return $id;
}

test('a college officer sees their college\'s proposals and counts, not their own (empty) list', function () {
    DB::table('app_settings')->updateOrInsert(['key' => 'current_academic_year'], ['value' => '2026-2027', 'type' => 'string', 'group' => 'general']);
    $officer = dash_makeCollegeUser('college_officer');
    $college = College::find($officer->college_id);
    $elsewhere = College::create(['name' => 'Other '.rand(), 'code' => 'DO'.rand(10000, 99999)]);
    Department::create(['college_id' => $elsewhere->id, 'name' => 'D', 'code' => 'DE'.rand(10000, 99999)]);
    $pi = dash_makeUser('staff');

    dash_proposal($college, $pi, 'funded');
    dash_proposal($college, $pi, 'under_blind_review');
    dash_proposal($college, $pi, 'draft');
    dash_proposal($elsewhere, $pi, 'funded');

    $widgets = app(DashboardService::class)->getWidgets($officer);

    expect($widgets['college_proposals'])->toHaveCount(2)
        ->and($widgets['headline']['funded'])->toBe(1)
        ->and($widgets['headline']['under_review'])->toBe(1)
        ->and($widgets['headline']['submitted'])->toBe(2);
});

test('the budget summary uses the academic year, the same as the annual report', function () {
    DB::table('app_settings')->updateOrInsert(['key' => 'current_academic_year'], ['value' => '2026-2027', 'type' => 'string', 'group' => 'general']);
    $finance = dash_makeUser('finance_officer');
    $college = College::create(['name' => 'Budget '.rand(), 'code' => 'DB'.rand(10000, 99999)]);
    DB::table('budget_allocations')->insert([
        'id' => (string) Str::uuid(), 'college_id' => $college->id, 'fiscal_year' => '2026-2027', 'total_amount' => 250000,
        'remaining_balance' => 250000, 'allocation_type' => 'proposal', 'allocated_by' => $finance->id, 'created_at' => now(), 'updated_at' => now(),
    ]);

    $summary = app(DashboardService::class)->getWidgets($finance)['budget_utilization_summary'];

    expect($summary['fiscal_year'])->toBe('2026-2027')
        ->and((float) $summary['total_allocated'])->toBe(250000.0);
});

test('reviews to do appear for anyone who has them, and not for officers who have none', function () {
    $admin = dash_makeUser('central_officer');
    expect(app(DashboardService::class)->getWidgets($admin)['pending_tasks'])->not->toHaveKey('reviews_pending');

    $reviewer = dash_makeUser('external_reviewer');
    $college = College::create(['name' => 'Rev '.rand(), 'code' => 'DR'.rand(10000, 99999)]);
    Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'DRD'.rand(10000, 99999)]);
    $pi = dash_makeUser('staff');
    $type = EvaluationType::create(['name' => 'blind_review_dash', 'label' => 'Blind', 'is_active' => true])->id;
    foreach ([['accepted', -2], ['in_progress', 5], ['cancelled', -2]] as [$status, $due]) {
        DB::table('review_assignments')->insert([
            'id' => (string) Str::uuid(), 'proposal_id' => dash_proposal($college, $pi, 'under_blind_review'), 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type,
            'assigned_by' => $admin->id, 'status' => $status, 'assigned_at' => now(), 'due_date' => now()->addDays($due)->toDateString(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    $tasks = app(DashboardService::class)->getWidgets($reviewer)['pending_tasks'];

    expect($tasks['reviews_pending'])->toBe(2)
        ->and($tasks['reviews_overdue'])->toBe(1);
});
