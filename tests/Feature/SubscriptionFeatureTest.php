<?php

use App\Enums\Feature;
use App\Models\AppSetting;
use App\Models\User;
use App\Services\FeatureService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Cache::flush();
});

// ── FeatureService ────────────────────────────────────────────────────────────

test('hasFeature returns true for all features when no setting exists', function () {
    expect(app(FeatureService::class)->hasFeature(Feature::Finance))->toBeTrue();
    expect(app(FeatureService::class)->hasFeature(Feature::Reports))->toBeTrue();
});

test('hasFeature returns true for enabled features', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode(['proposals', 'finance']), 'type' => 'json', 'group' => 'features']);

    Cache::flush();
    expect(app(FeatureService::class)->hasFeature(Feature::Finance))->toBeTrue();
    expect(app(FeatureService::class)->hasFeature(Feature::Proposals))->toBeTrue();
});

test('hasFeature returns false for disabled features', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode(['proposals']), 'type' => 'json', 'group' => 'features']);

    Cache::flush();
    expect(app(FeatureService::class)->hasFeature(Feature::Finance))->toBeFalse();
    expect(app(FeatureService::class)->hasFeature('reports'))->toBeFalse();
});

test('setEnabledFeatures persists and flushes cache', function () {
    $service = app(FeatureService::class);

    $service->setEnabledFeatures(['proposals', 'evaluation']);
    expect($service->hasFeature(Feature::Finance))->toBeFalse();
    expect($service->hasFeature(Feature::Proposals))->toBeTrue();

    $service->setEnabledFeatures(['proposals', 'finance']);
    expect($service->hasFeature(Feature::Finance))->toBeTrue();
});

test('clearCache allows fresh DB read on next call', function () {
    $service = app(FeatureService::class);
    $service->setEnabledFeatures(['proposals']);
    expect($service->hasFeature(Feature::Finance))->toBeFalse();

    // Directly update DB bypassing service (simulates external change)
    AppSetting::where('key', 'enabled_features')->update(['value' => json_encode(['proposals', 'finance'])]);
    $service->clearCache();

    expect($service->hasFeature(Feature::Finance))->toBeTrue();
});

// ── Gates ─────────────────────────────────────────────────────────────────────

test('feature gate allows when feature is globally enabled', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode(['finance']), 'type' => 'json', 'group' => 'features']);
    Cache::flush();

    $user = User::factory()->create();
    $user->assignRole('staff');

    expect(Gate::forUser($user)->allows('feature:finance'))->toBeTrue();
});

test('feature gate denies when feature is globally disabled', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode(['proposals']), 'type' => 'json', 'group' => 'features']);
    Cache::flush();

    $user = User::factory()->create();
    $user->assignRole('staff');

    expect(Gate::forUser($user)->allows('feature:reports'))->toBeFalse();
});

test('super_admin always passes the feature gate even when feature is disabled', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode([]), 'type' => 'json', 'group' => 'features']);
    Cache::flush();

    $user = User::factory()->create();
    $user->assignRole('super_admin');

    expect(Gate::forUser($user)->allows('feature:finance'))->toBeTrue();
    expect(Gate::forUser($user)->allows('feature:reports'))->toBeTrue();
});

// ── Middleware ────────────────────────────────────────────────────────────────

test('feature middleware returns 403 when feature is disabled globally', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode(['proposals']), 'type' => 'json', 'group' => 'features']);
    Cache::flush();

    $user = User::factory()->create();
    $user->assignRole('staff');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/complaints')
        ->assertForbidden()
        ->assertJson(['message' => 'This feature is not available on your current subscription plan.']);
});

test('feature middleware allows when feature is enabled', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode(['proposals', 'complaints']), 'type' => 'json', 'group' => 'features']);
    Cache::flush();

    $user = User::factory()->create();
    $user->assignRole('staff');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/complaints')
        ->assertSuccessful();
});

test('super_admin bypasses feature middleware even with empty enabled list', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode([]), 'type' => 'json', 'group' => 'features']);
    Cache::flush();

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/reports')
        ->assertSuccessful();
});

// ── /features API ─────────────────────────────────────────────────────────────

test('super_admin can toggle a feature off', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/features/toggle', ['slug' => 'finance', 'enabled' => false])
        ->assertSuccessful();

    Cache::flush();
    expect(app(FeatureService::class)->hasFeature(Feature::Finance))->toBeFalse();
});

test('super_admin can bulk update enabled features', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->putJson('/api/v1/features', ['features' => ['proposals', 'evaluation']])
        ->assertSuccessful();

    Cache::flush();
    expect(app(FeatureService::class)->getEnabledFeatures())->toBe(['proposals', 'evaluation']);
});

test('enabled_features is shared via Inertia props', function () {
    AppSetting::create(['key' => 'enabled_features', 'value' => json_encode(['proposals', 'finance']), 'type' => 'json', 'group' => 'features']);
    Cache::flush();

    $this->get('/dashboard')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page->has('enabled_features'));
});

// ── New role hierarchy ────────────────────────────────────────────────────────

test('new roles exist in the database', function () {
    foreach (['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer', 'college_officer', 'support_officer', 'staff'] as $role) {
        expect(Role::where('name', $role)->exists())->toBeTrue("Role {$role} should exist");
    }
});

test('retired roles no longer exist', function () {
    // central_officer, college_officer, pi and reviewer are current roles (see
    // RolePermissionSeeder); only these two were retired.
    foreach (['finance', 'department_head'] as $role) {
        expect(Role::where('name', $role)->exists())->toBeFalse("Old role {$role} should be gone");
    }
});

test('staff role has proposal creation permission', function () {
    $user = User::factory()->create();
    $user->assignRole('staff');
    expect($user->hasPermissionTo('proposals.create'))->toBeTrue();
});

test('support_officer has disbursement permissions', function () {
    $user = User::factory()->create();
    $user->assignRole('support_officer');
    expect($user->hasPermissionTo('disbursements.create'))->toBeTrue();
});

test('college_officer has midterm evaluation permissions', function () {
    $user = User::factory()->create();
    $user->assignRole('college_officer');
    expect($user->hasPermissionTo('midterm_evaluations.create'))->toBeTrue();
});
