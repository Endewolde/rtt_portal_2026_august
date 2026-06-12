<?php

use App\Models\ThematicArea;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── Public endpoint ──────────────────────────────────────────────────────────

test('public endpoint returns only active thematic areas', function () {
    ThematicArea::create(['name' => 'Active Area',   'is_active' => true]);
    ThematicArea::create(['name' => 'Inactive Area', 'is_active' => false]);

    $this->getJson('/api/v1/thematic-areas/public')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Active Area');
});

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

test('super admin can create a thematic area', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/thematic-areas', [
            'name' => 'Health Sciences',
            'description' => 'Biomedical and clinical research',
            'icon' => '🏥',
            'color' => '#ef4444',
        ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Health Sciences');

    expect(ThematicArea::where('name', 'Health Sciences')->exists())->toBeTrue();
});

test('super admin can update a thematic area', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $area = ThematicArea::create(['name' => 'Old Name']);

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/thematic-areas/{$area->id}", ['name' => 'New Name'])
        ->assertOk()
        ->assertJsonPath('data.name', 'New Name');
});

test('super admin can delete a thematic area', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $area = ThematicArea::create(['name' => 'To Delete']);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/thematic-areas/{$area->id}")
        ->assertOk();

    expect(ThematicArea::find($area->id))->toBeNull();
});

test('non super admin cannot create a thematic area', function () {
    $user = User::factory()->create();
    $user->assignRole('admin');

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/thematic-areas', ['name' => 'Blocked'])
        ->assertForbidden();
});

test('creating a thematic area requires a name', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/thematic-areas', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name']);
});
