<?php

use App\Models\College;
use App\Models\ExternalFundAgency;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundAward;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ef_manager(): User
{
    $user = User::factory()->create();
    $user->assignRole('research_officer');

    return $user;
}

function ef_staff(): User
{
    $user = User::factory()->create();
    $user->assignRole('staff');

    return $user;
}

function ef_agency(User $creator): ExternalFundAgency
{
    return ExternalFundAgency::create([
        'name' => 'Test Agency '.rand(),
        'type' => 'international',
        'is_active' => true,
        'created_by' => $creator->id,
    ]);
}

function ef_application(User $pi, ExternalFundAgency $agency, array $overrides = []): ExternalFundApplication
{
    return ExternalFundApplication::create(array_merge([
        'agency_id' => $agency->id,
        'pi_user_id' => $pi->id,
        'ref_number' => 'EF-RES-'.rand(100000, 999999),
        'title' => 'Test Application',
        'category' => 'research',
        'status' => 'draft',
        'currency' => 'USD',
        'created_by' => $pi->id,
    ], $overrides));
}

function ef_award(User $creator, ExternalFundApplication $application): ExternalFundAward
{
    return ExternalFundAward::create([
        'application_id' => $application->id,
        'agency_id' => $application->agency_id,
        'award_number' => 'AWD-'.rand(100000, 999999),
        'title' => 'Test Award',
        'amount_awarded' => 100000,
        'currency' => 'USD',
        'start_date' => now()->toDateString(),
        'end_date' => now()->addYear()->toDateString(),
        'status' => 'active',
        'created_by' => $creator->id,
    ]);
}

// ─── Agencies — open read, gated write ──────────────────────────────────────

test('any authenticated user can list agencies', function () {
    $manager = ef_manager();
    ef_agency($manager);

    $this->actingAs(ef_staff(), 'sanctum')
        ->getJson('/api/v1/external-funds/agencies')
        ->assertOk();
});

test('a plain staff member cannot create an agency', function () {
    $this->actingAs(ef_staff(), 'sanctum')
        ->postJson('/api/v1/external-funds/agencies', [
            'name' => 'New Agency', 'type' => 'ngo',
        ])
        ->assertStatus(403);
});

test('research_officer can create an agency', function () {
    $this->actingAs(ef_manager(), 'sanctum')
        ->postJson('/api/v1/external-funds/agencies', [
            'name' => 'New Agency', 'type' => 'ngo',
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'New Agency');
});

test('only super_admin/admin can delete an agency, not a research_officer', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);

    $this->actingAs($manager, 'sanctum')
        ->deleteJson("/api/v1/external-funds/agencies/{$agency->id}")
        ->assertStatus(403);

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/external-funds/agencies/{$agency->id}")
        ->assertOk();
});

// ─── Applications — index/show scoped to owner-or-manager ──────────────────

test('index only returns a non-manager user\'s own applications', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);

    $owner = ef_staff();
    $ownApp = ef_application($owner, $agency);

    $otherStaff = ef_staff();
    ef_application($otherStaff, $agency);

    $response = $this->actingAs($owner, 'sanctum')->getJson('/api/v1/external-funds/applications')->assertOk();
    $ids = collect($response->json('data.data'))->pluck('id');

    expect($ids)->toContain($ownApp->id)->and($ids)->toHaveCount(1);
});

test('show allows the owner and a manager, denies an unrelated staff member', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $owner = ef_staff();
    $application = ef_application($owner, $agency);

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/external-funds/applications/{$application->id}")
        ->assertOk();

    $this->actingAs($manager, 'sanctum')
        ->getJson("/api/v1/external-funds/applications/{$application->id}")
        ->assertOk();

    $outsider = ef_staff();
    $this->actingAs($outsider, 'sanctum')
        ->getJson("/api/v1/external-funds/applications/{$application->id}")
        ->assertStatus(403);
});

test('any authenticated user can create an application for themselves', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $staff = ef_staff();

    $this->actingAs($staff, 'sanctum')
        ->postJson('/api/v1/external-funds/applications', [
            'agency_id' => $agency->id,
            'title' => 'My Application',
            'category' => 'research',
        ])
        ->assertCreated()
        ->assertJsonPath('data.pi_user_id', $staff->id);
});

test('the owner can update their own draft application, an unrelated staff member cannot', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $owner = ef_staff();
    $application = ef_application($owner, $agency);

    $this->actingAs($owner, 'sanctum')
        ->putJson("/api/v1/external-funds/applications/{$application->id}", ['title' => 'Updated Title'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Updated Title');

    $outsider = ef_staff();
    $this->actingAs($outsider, 'sanctum')
        ->putJson("/api/v1/external-funds/applications/{$application->id}", ['title' => 'Hijacked'])
        ->assertStatus(403);
});

test('only a manager can advance application status', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $owner = ef_staff();
    $application = ef_application($owner, $agency);

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/external-funds/applications/{$application->id}/status", ['status' => 'submitted'])
        ->assertStatus(403);

    $this->actingAs($manager, 'sanctum')
        ->patchJson("/api/v1/external-funds/applications/{$application->id}/status", ['status' => 'submitted'])
        ->assertOk()
        ->assertJsonPath('data.status', 'submitted');
});

// ─── Awards — manager-gated, money-critical ─────────────────────────────────

test('a plain staff member cannot record an award', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $application = ef_application(ef_staff(), $agency);

    $this->actingAs(ef_staff(), 'sanctum')
        ->postJson('/api/v1/external-funds/awards', [
            'application_id' => $application->id,
            'title' => 'Award Title',
            'amount_awarded' => 50000,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'active',
        ])
        ->assertStatus(403);
});

test('a manager can record an award and it marks the application as awarded', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $application = ef_application(ef_staff(), $agency);

    $this->actingAs($manager, 'sanctum')
        ->postJson('/api/v1/external-funds/awards', [
            'application_id' => $application->id,
            'title' => 'Award Title',
            'amount_awarded' => 50000,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'active',
        ])
        ->assertCreated()
        ->assertJsonPath('data.amount_awarded', '50000.00');

    expect($application->fresh()->status)->toBe('awarded');
});

// ─── Expenditures — manager-gated, tallied against the award ───────────────

test('a plain staff member cannot record an expenditure', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $award = ef_award($manager, ef_application(ef_staff(), $agency));

    $this->actingAs(ef_staff(), 'sanctum')
        ->postJson("/api/v1/external-funds/awards/{$award->id}/expenditures", [
            'description' => 'Equipment purchase',
            'amount' => 1000,
            'expense_date' => now()->toDateString(),
            'category' => 'equipment',
        ])
        ->assertStatus(403);
});

test('finance_officer can record an expenditure and remaining budget is tallied correctly', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $award = ef_award($manager, ef_application(ef_staff(), $agency));

    $finance = User::factory()->create(['college_id' => College::create(['name' => 'EF Finance College '.rand(), 'code' => 'EFC'.rand(10, 99)])->id]);
    $finance->assignRole('finance_officer');

    $this->actingAs($finance, 'sanctum')
        ->postJson("/api/v1/external-funds/awards/{$award->id}/expenditures", [
            'description' => 'Equipment purchase',
            'amount' => 15000,
            'expense_date' => now()->toDateString(),
            'category' => 'equipment',
        ])
        ->assertCreated();

    $response = $this->actingAs($manager, 'sanctum')
        ->getJson("/api/v1/external-funds/awards/{$award->id}/expenditures")
        ->assertOk();

    expect($response->json('meta.total_spent'))->toEqual(15000)
        ->and($response->json('meta.remaining_budget'))->toEqual(85000);
});

// ─── Milestones ──────────────────────────────────────────────────────────────

test('a plain staff member cannot add a milestone, a manager can', function () {
    $manager = ef_manager();
    $agency = ef_agency($manager);
    $award = ef_award($manager, ef_application(ef_staff(), $agency));

    $this->actingAs(ef_staff(), 'sanctum')
        ->postJson("/api/v1/external-funds/awards/{$award->id}/milestones", [
            'title' => 'Phase 1 report', 'due_date' => now()->addMonths(3)->toDateString(),
        ])
        ->assertStatus(403);

    $this->actingAs($manager, 'sanctum')
        ->postJson("/api/v1/external-funds/awards/{$award->id}/milestones", [
            'title' => 'Phase 1 report', 'due_date' => now()->addMonths(3)->toDateString(),
        ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Phase 1 report');
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

test('dashboard metrics endpoint is reachable by any authenticated user', function () {
    $this->actingAs(ef_staff(), 'sanctum')
        ->getJson('/api/v1/external-funds/dashboard')
        ->assertOk();
});
