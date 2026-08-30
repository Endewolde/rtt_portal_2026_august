<?php

use App\Models\Resource;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('public index only returns active resources, unauthenticated', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    Resource::create(['title' => 'Active', 'category' => 'guideline', 'is_active' => true, 'sort_order' => 0, 'created_by' => $admin->id]);
    Resource::create(['title' => 'Inactive', 'category' => 'guideline', 'is_active' => false, 'sort_order' => 0, 'created_by' => $admin->id]);

    $response = $this->getJson('/api/v1/resources')->assertOk();

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.title'))->toBe('Active');
});

test('a plain staff member cannot create a resource', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->postJson('/api/v1/admin/resources', ['title' => 'New Resource', 'category' => 'template'])
        ->assertStatus(403);
});

test('a user with settings.manage can create, update, and delete a resource', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $created = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/admin/resources', [
            'title' => 'New Resource', 'category' => 'template',
            'file' => UploadedFile::fake()->create('template.docx', 100),
        ])
        ->assertCreated()
        ->json('data');

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/admin/resources/{$created['id']}", ['title' => 'Renamed'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Renamed');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/admin/resources/{$created['id']}")
        ->assertOk();

    expect(Resource::find($created['id']))->toBeNull();
});
