<?php

use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function abstract_makeConferenceAbstract(string $submitterEmail = 'submitter@example.com'): ConferenceAbstract
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $conference = Conference::create([
        'title' => 'Test Conference',
        'start_date' => now()->addMonth(),
        'end_date' => now()->addMonth()->addDays(2),
        'status' => 'published',
        'created_by' => $admin->id,
    ]);

    return ConferenceAbstract::create([
        'conference_id' => $conference->id,
        'submitter_name' => 'Jane Submitter',
        'submitter_email' => $submitterEmail,
        'title' => 'A Study on Something',
        'body' => 'Abstract body text.',
        'status' => 'submitted',
        'submitted_at' => now(),
    ]);
}

test('admin cannot assign a reviewer who submitted the abstract', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $abstract = abstract_makeConferenceAbstract('staffmember@example.com');

    $staffReviewer = User::factory()->create(['email' => 'staffmember@example.com']);
    $staffReviewer->assignRole('staff');

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/admin/abstracts/{$abstract->id}/assign-reviewer", [
            'reviewer_id' => $staffReviewer->id,
        ]);

    $response->assertStatus(422);
    expect($response->json('message'))->toContain('submitted this abstract');

    expect(ConferenceAbstractReview::where('abstract_id', $abstract->id)
        ->where('reviewer_id', $staffReviewer->id)
        ->exists())->toBeFalse();
});

test('email match is case-insensitive when blocking self-review assignment', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $abstract = abstract_makeConferenceAbstract('Staff.Member@Example.com');

    $staffReviewer = User::factory()->create(['email' => 'staff.member@example.com']);
    $staffReviewer->assignRole('staff');

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/admin/abstracts/{$abstract->id}/assign-reviewer", [
            'reviewer_id' => $staffReviewer->id,
        ]);

    $response->assertStatus(422);
});

test('admin can assign a reviewer who did not submit the abstract', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $abstract = abstract_makeConferenceAbstract('someone-else@example.com');

    $staffReviewer = User::factory()->create(['email' => 'staffmember@example.com']);
    $staffReviewer->assignRole('staff');

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/admin/abstracts/{$abstract->id}/assign-reviewer", [
            'reviewer_id' => $staffReviewer->id,
        ]);

    $response->assertOk();

    expect(ConferenceAbstractReview::where('abstract_id', $abstract->id)
        ->where('reviewer_id', $staffReviewer->id)
        ->exists())->toBeTrue();
});
