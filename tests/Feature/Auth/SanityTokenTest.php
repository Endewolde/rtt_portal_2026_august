<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('a deleted token can no longer authenticate', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123!')]);

    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'Password123!',
    ])->assertOk()->json('data.token');

    $this->withHeaders(['Authorization' => "Bearer $token"])
        ->getJson('/api/v1/auth/me')
        ->assertOk();

    $user->tokens()->delete();

    // A fresh application instance is required here to avoid Sanctum's
    // RequestGuard reusing its cached resolved user from the previous
    // request within this same test method — a Pest/Laravel TestCase
    // artifact that does not occur across real, separate HTTP requests.
    $this->refreshApplication();

    $this->withHeaders(['Authorization' => "Bearer $token"])
        ->getJson('/api/v1/auth/me')
        ->assertStatus(401);
});
