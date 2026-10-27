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
        ->patchJson("/api/v1/external-funds/applications/{$application->id}/status", ['status' => 'under_internal_review'])
        ->assertStatus(403);

    $this->actingAs($manager, 'sanctum')
        ->patchJson("/api/v1/external-funds/applications/{$application->id}/status", ['status' => 'under_internal_review'])
        ->assertOk()
        ->assertJsonPath('data.status', 'under_internal_review');
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
    $application = ef_application(ef_staff(), $agency, ['status' => 'submitted']);

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

    $finance = User::factory()->create(['college_id' => College::create(['name' => 'EF Finance College '.rand(), 'code' => 'EFC'.rand(10000, 99999)])->id]);
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

test('dashboard metrics are for the office, not every signed-in user', function () {
    $this->actingAs(ef_staff(), 'sanctum')
        ->getJson('/api/v1/external-funds/dashboard')
        ->assertForbidden();

    $this->actingAs(ef_manager(), 'sanctum')
        ->getJson('/api/v1/external-funds/dashboard')
        ->assertOk()
        ->assertJsonStructure(['data' => ['by_currency', 'currency', 'overdue_milestones']]);
});

// ─── Workflow & access hardening ────────────────────────────────────────────

test('a search cannot leak other people\'s applications to a non-manager', function () {
    $agency = ef_agency(ef_manager());
    $owner = ef_staff();
    ef_application($owner, $agency, ['title' => 'Mine about water']);
    ef_application(ef_staff(), $agency, ['title' => 'Theirs', 'ref_number' => 'EF-RES-WATER1']);

    $titles = collect($this->actingAs($owner, 'sanctum')->getJson('/api/v1/external-funds/applications?search=water')->json('data.data'))->pluck('title');

    expect($titles->all())->toBe(['Mine about water']);
});

test('reviews, budgets, team, documents and awards of an application are hidden from outsiders', function () {
    $manager = ef_manager();
    $application = ef_application(ef_staff(), ef_agency($manager), ['status' => 'submitted']);
    $award = ef_award($manager, $application);
    $outsider = ef_staff();

    foreach ([
        "/api/v1/external-funds/applications/{$application->id}/reviews",
        "/api/v1/external-funds/applications/{$application->id}/budgets",
        "/api/v1/external-funds/applications/{$application->id}/team-members",
        "/api/v1/external-funds/applications/{$application->id}/documents",
        "/api/v1/external-funds/awards/{$award->id}",
        "/api/v1/external-funds/awards/{$award->id}/expenditures",
        "/api/v1/external-funds/awards/{$award->id}/milestones",
    ] as $url) {
        $this->actingAs($outsider, 'sanctum')->getJson($url)->assertForbidden();
    }

    expect($this->actingAs($outsider, 'sanctum')->getJson('/api/v1/external-funds/awards')->json('data.total'))->toBe(0);
});

test('status follows the workflow: no skipping review, no awarding by hand, and every stage must currently approve', function () {
    $manager = ef_manager();
    $application = ef_application(ef_staff(), ef_agency($manager));
    $url = "/api/v1/external-funds/applications/{$application->id}";

    $this->actingAs($manager, 'sanctum')->patchJson("{$url}/status", ['status' => 'submitted'])->assertUnprocessable();
    $this->actingAs($manager, 'sanctum')->patchJson("{$url}/status", ['status' => 'awarded'])->assertUnprocessable();

    foreach (['department', 'college', 'research_office', 'management'] as $stage) {
        $this->actingAs($manager, 'sanctum')->postJson("{$url}/reviews", ['stage' => $stage, 'status' => 'approved'])->assertCreated();
    }
    expect($application->fresh()->status)->toBe('under_internal_review');

    // A later "revision required" at one stage outweighs the earlier approval there.
    $this->travel(1)->minutes();
    $other = ef_manager();
    $this->actingAs($other, 'sanctum')->postJson("{$url}/reviews", ['stage' => 'college', 'status' => 'revision_required'])->assertCreated();
    $this->actingAs($manager, 'sanctum')->patchJson("{$url}/status", ['status' => 'approved_for_submission'])
        ->assertUnprocessable()->assertJsonPath('meta.approved_count', 3);

    $this->travel(1)->minutes();
    $this->actingAs($other, 'sanctum')->postJson("{$url}/reviews", ['stage' => 'college', 'status' => 'approved'])->assertCreated();
    $this->actingAs($manager, 'sanctum')->patchJson("{$url}/status", ['status' => 'approved_for_submission'])->assertOk();

    // Internal review is closed now.
    $this->actingAs($manager, 'sanctum')->postJson("{$url}/reviews", ['stage' => 'college', 'status' => 'rejected'])->assertUnprocessable();
});

test('the owner can no longer edit once the application is in review', function () {
    $owner = ef_staff();
    $application = ef_application($owner, ef_agency(ef_manager()), ['status' => 'under_internal_review']);

    $this->actingAs($owner, 'sanctum')->putJson("/api/v1/external-funds/applications/{$application->id}", ['title' => 'Changed'])->assertUnprocessable();
});

test('an award needs a submitted application, only one per application, and takes over its budget lines', function () {
    $manager = ef_manager();
    $application = ef_application(ef_staff(), ef_agency($manager));
    $application->budgets()->create(['category' => 'travel', 'description' => 'Field trips', 'proposed_amount' => 5000]);
    $payload = ['application_id' => $application->id, 'title' => 'Grant', 'amount_awarded' => 10000, 'start_date' => now()->toDateString(), 'end_date' => now()->addYear()->toDateString(), 'status' => 'active'];

    $this->actingAs($manager, 'sanctum')->postJson('/api/v1/external-funds/awards', $payload)->assertUnprocessable();

    $application->update(['status' => 'submitted']);
    $awardId = $this->actingAs($manager, 'sanctum')->postJson('/api/v1/external-funds/awards', $payload)->assertCreated()->json('data.id');
    expect($application->budgets()->first()->award_id)->toBe($awardId);

    $application->update(['status' => 'under_review']);
    $this->actingAs($manager, 'sanctum')->postJson('/api/v1/external-funds/awards', $payload)->assertUnprocessable();

    $this->actingAs($manager, 'sanctum')->putJson("/api/v1/external-funds/awards/{$awardId}", ['end_date' => now()->subDay()->toDateString()])
        ->assertUnprocessable();
});

test('spending cannot exceed the award, needs an active award and a budget line of the same application, and can be removed', function () {
    $manager = ef_manager();
    $application = ef_application(ef_staff(), ef_agency($manager), ['status' => 'submitted']);
    $award = ef_award($manager, $application);
    $otherBudget = ef_application(ef_staff(), ef_agency($manager))->budgets()->create(['category' => 'travel', 'description' => 'Other', 'proposed_amount' => 10]);
    $url = "/api/v1/external-funds/awards/{$award->id}/expenditures";
    $line = fn (array $extra = []) => ['description' => 'Lab kit', 'amount' => 60000, 'expense_date' => now()->toDateString(), 'category' => 'equipment', ...$extra];

    $this->actingAs($manager, 'sanctum')->postJson($url, $line())->assertCreated();
    $this->actingAs($manager, 'sanctum')->postJson($url, $line())->assertUnprocessable()->assertJsonValidationErrors('amount');
    $this->actingAs($manager, 'sanctum')->postJson($url, $line(['amount' => 10, 'budget_id' => $otherBudget->id]))->assertUnprocessable();

    $id = $this->actingAs($manager, 'sanctum')->postJson($url, $line(['amount' => 40000]))->assertCreated()->json('data.id');
    $this->actingAs($manager, 'sanctum')->deleteJson("/api/v1/external-funds/expenditures/{$id}")->assertOk();

    $award->update(['status' => 'suspended']);
    $this->actingAs($manager, 'sanctum')->postJson($url, $line(['amount' => 1]))->assertUnprocessable();
});

test('an agency or application with history cannot be deleted, and opportunity ranges must make sense', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $agency = ef_agency($admin);
    $application = ef_application(ef_staff(), $agency, ['status' => 'submitted']);
    ef_award($admin, $application);

    $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/external-funds/agencies/{$agency->id}")->assertUnprocessable();
    $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/external-funds/applications/{$application->id}")->assertUnprocessable();

    $this->actingAs($admin, 'sanctum')->postJson('/api/v1/external-funds/opportunities', [
        'agency_id' => $agency->id, 'title' => 'Call', 'category' => 'research', 'type' => 'grant', 'status' => 'draft',
        'amount_min' => 5000, 'amount_max' => 1000, 'opening_date' => now()->toDateString(), 'deadline' => now()->subWeek()->toDateString(),
    ])->assertUnprocessable()->assertJsonValidationErrors(['amount_max', 'deadline']);
});
