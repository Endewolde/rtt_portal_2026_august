<?php

use App\Jobs\SendRawMailJob;
use App\Models\Conference;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Bus::fake();
});

function cf_conference(User $creator, array $overrides = []): Conference
{
    return Conference::create(array_merge([
        'title' => 'Test Conference '.rand(),
        'slug' => 'test-conf-'.rand(100000, 999999),
        'start_date' => now()->addMonth(),
        'location_type' => 'virtual',
        'status' => 'published',
        'created_by' => $creator->id,
    ], $overrides));
}

// ─── Public ──────────────────────────────────────────────────────────────────

test('public index only returns published conferences', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    cf_conference($admin, ['status' => 'published']);
    cf_conference($admin, ['status' => 'draft']);

    $response = $this->getJson('/api/v1/conferences')->assertOk();

    expect($response->json('data.data'))->toHaveCount(1);
});

test('public show returns capacity info by slug', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $conference = cf_conference($admin, ['max_capacity' => 2]);

    $response = $this->getJson("/api/v1/conferences/{$conference->slug}")->assertOk();

    expect($response->json('data.spots_remaining'))->toBe(2)
        ->and($response->json('data.is_full'))->toBeFalse();
});

test('public show 404s for a draft conference', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $conference = cf_conference($admin, ['status' => 'draft']);

    $this->getJson("/api/v1/conferences/{$conference->slug}")->assertNotFound();
});

// ─── register ────────────────────────────────────────────────────────────────

test('anyone can register for a published conference', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $conference = cf_conference($admin);

    $this->postJson("/api/v1/conferences/{$conference->slug}/register", [
        'name' => 'Jane Doe', 'email' => 'jane@example.com',
    ])->assertCreated();

    expect($conference->registrations()->where('email', 'jane@example.com')->exists())->toBeTrue();
    Bus::assertDispatched(SendRawMailJob::class);
});

test('cannot register twice with the same email', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $conference = cf_conference($admin);
    $conference->registrations()->create(['name' => 'Jane Doe', 'email' => 'jane@example.com', 'registered_at' => now()]);

    $this->postJson("/api/v1/conferences/{$conference->slug}/register", [
        'name' => 'Jane Doe', 'email' => 'jane@example.com',
    ])->assertStatus(422);
});

test('registration is rejected once the conference is fully booked', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $conference = cf_conference($admin, ['max_capacity' => 1]);
    $conference->registrations()->create(['name' => 'First', 'email' => 'first@example.com', 'status' => 'confirmed', 'registered_at' => now()]);

    $this->postJson("/api/v1/conferences/{$conference->slug}/register", [
        'name' => 'Second', 'email' => 'second@example.com',
    ])->assertStatus(422);
});

// ─── Admin CRUD ──────────────────────────────────────────────────────────────

test('a plain staff member cannot list or create conferences', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')->getJson('/api/v1/admin/conferences')->assertStatus(403);
    $this->actingAs($staff, 'sanctum')->postJson('/api/v1/admin/conferences', [
        'title' => 'New Conf', 'start_date' => now()->addMonth()->toDateString(), 'location_type' => 'virtual',
    ])->assertStatus(403);
});

test('admin can create, update, and delete a conference', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $created = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/admin/conferences', [
            'title' => 'Brand New Conference',
            'start_date' => now()->addMonth()->toDateString(),
            'location_type' => 'virtual',
        ])
        ->assertCreated()
        ->json('data');

    expect($created['slug'])->toStartWith('brand-new-conference');

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/admin/conferences/{$created['id']}", ['title' => 'Renamed Conference'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Renamed Conference');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/admin/conferences/{$created['id']}")
        ->assertOk();

    expect(Conference::find($created['id']))->toBeNull();
});

// ─── Admin — registrations list ─────────────────────────────────────────────

test('admin can list registrations for a conference, a plain staff member cannot', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $conference = cf_conference($admin);
    $conference->registrations()->create(['name' => 'Jane Doe', 'email' => 'jane@example.com', 'registered_at' => now()]);

    $this->actingAs($admin, 'sanctum')
        ->getJson("/api/v1/admin/conferences/{$conference->id}/registrations")
        ->assertOk()
        ->assertJsonCount(1, 'data');

    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff, 'sanctum')
        ->getJson("/api/v1/admin/conferences/{$conference->id}/registrations")
        ->assertStatus(403);
});
