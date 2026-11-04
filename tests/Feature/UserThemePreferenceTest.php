<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->user = User::factory()->create();
    $this->user->assignRole('staff');
});

test('a person can choose their own theme, and it comes back with their account on any device', function (string $theme) {
    $this->actingAs($this->user, 'sanctum')
        ->putJson('/api/v1/auth/profile', ['theme' => $theme])
        ->assertOk()
        ->assertJsonPath('data.user.theme', $theme);

    $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/auth/me')->assertJsonPath('data.user.theme', $theme);
})->with(['light', 'dark', 'system']);

test('choosing the organisation default clears the personal theme', function () {
    $this->user->update(['theme' => 'dark']);

    $this->actingAs($this->user, 'sanctum')
        ->putJson('/api/v1/auth/profile', ['theme' => null])
        ->assertOk();

    expect($this->user->fresh()->theme)->toBeNull();
});

test('only known themes are accepted', function () {
    $this->actingAs($this->user, 'sanctum')
        ->putJson('/api/v1/auth/profile', ['theme' => 'sepia'])
        ->assertUnprocessable();

    expect($this->user->fresh()->theme)->toBeNull();
});

test('one person\'s theme does not change anyone else\'s', function () {
    $other = User::factory()->create();
    $other->assignRole('staff');

    $this->actingAs($this->user, 'sanctum')->putJson('/api/v1/auth/profile', ['theme' => 'dark'])->assertOk();

    expect($other->fresh()->theme)->toBeNull();
});
