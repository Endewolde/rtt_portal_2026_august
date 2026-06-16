<?php

use App\Models\FeedbackSubmission;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('a user can submit feedback', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/v1/feedback', [
        'type' => 'feature_request',
        'rating' => 4,
        'message' => 'Please add dark mode.',
    ]);

    $response->assertCreated();
    expect(FeedbackSubmission::where('user_id', $user->id)->exists())->toBeTrue();
});

test('a user cannot submit feedback twice', function () {
    $user = User::factory()->create();
    FeedbackSubmission::create([
        'id' => Str::uuid(),
        'user_id' => $user->id,
        'type' => 'feedback',
        'message' => 'Already submitted.',
    ]);

    $response = $this->actingAs($user)->postJson('/api/v1/feedback', [
        'type' => 'feedback',
        'message' => 'Trying again.',
    ]);

    $response->assertStatus(422);
    expect(FeedbackSubmission::where('user_id', $user->id)->count())->toBe(1);
});

test('a non-admin cannot list feedback submissions', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->getJson('/api/v1/feedback')->assertStatus(403);
});

test('an admin can list feedback submissions', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $submitter = User::factory()->create();
    FeedbackSubmission::create([
        'id' => Str::uuid(),
        'user_id' => $submitter->id,
        'type' => 'bug_report',
        'message' => 'Found a bug.',
    ]);

    $response = $this->actingAs($admin)->getJson('/api/v1/feedback');

    $response->assertOk();
    expect($response->json('data.data'))->toHaveCount(1);
});

test('a non-admin cannot delete feedback submissions', function () {
    $user = User::factory()->create();
    $feedback = FeedbackSubmission::create([
        'id' => Str::uuid(),
        'user_id' => $user->id,
        'type' => 'feedback',
        'message' => 'Hello.',
    ]);

    $this->actingAs($user)->deleteJson("/api/v1/feedback/{$feedback->id}")->assertStatus(403);
    expect(FeedbackSubmission::find($feedback->id))->not->toBeNull();
});

test('an admin can delete a feedback submission', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $submitter = User::factory()->create();
    $feedback = FeedbackSubmission::create([
        'id' => Str::uuid(),
        'user_id' => $submitter->id,
        'type' => 'feedback',
        'message' => 'Delete me.',
    ]);

    $response = $this->actingAs($admin)->deleteJson("/api/v1/feedback/{$feedback->id}");

    $response->assertOk();
    expect(FeedbackSubmission::find($feedback->id))->toBeNull();
});

test('a non-admin cannot start a new round', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/feedback/new-round')->assertStatus(403);
    expect(FeedbackSubmission::currentRound())->toBe(1);
});

test('an admin can start a new round without losing past submissions', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $submitter = User::factory()->create();
    $feedback = FeedbackSubmission::create([
        'id' => Str::uuid(),
        'user_id' => $submitter->id,
        'type' => 'feedback',
        'message' => 'Round one feedback.',
    ]);

    $response = $this->actingAs($admin)->postJson('/api/v1/feedback/new-round');

    $response->assertOk();
    expect(FeedbackSubmission::currentRound())->toBe(2);
    expect(FeedbackSubmission::find($feedback->id))->not->toBeNull();
});

test('a user can submit feedback again in a new round after submitting in a previous one', function () {
    $user = User::factory()->create();
    FeedbackSubmission::create([
        'id' => Str::uuid(),
        'user_id' => $user->id,
        'round' => 1,
        'type' => 'feedback',
        'message' => 'Round one feedback.',
    ]);

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $this->actingAs($admin)->postJson('/api/v1/feedback/new-round')->assertOk();

    expect(FeedbackSubmission::hasSubmittedCurrentRound($user->id))->toBeFalse();

    $response = $this->actingAs($user)->postJson('/api/v1/feedback', [
        'type' => 'feedback',
        'message' => 'Round two feedback.',
    ]);

    $response->assertCreated();
    expect(FeedbackSubmission::where('user_id', $user->id)->count())->toBe(2);
});
