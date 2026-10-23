<?php

use App\Models\ReviewerApplication;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Storage::fake('private');

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
});

function rr_apply(array $overrides = [])
{
    return test()->post('/api/v1/reviewer-applications', array_merge([
        'name' => 'Dr. Hanna Girma', 'title' => 'Dr.', 'email' => 'Hanna@AAU.edu.et', 'organization' => 'Addis Ababa University',
        'position' => 'Associate Professor', 'qualification' => 'PhD', 'expertise' => ['Soil fertility', 'Agronomy'],
        'bio' => 'Twenty years in soil science.', 'orcid' => 'https://orcid.org/0000-0002-1825-0097',
        'cv' => UploadedFile::fake()->create('cv.pdf', 300, 'application/pdf'), 'consent' => '1',
    ], $overrides), ['Accept' => 'application/json']);
}

test('an outside expert can apply with their expertise and CV', function () {
    rr_apply()->assertCreated();

    $application = ReviewerApplication::first();
    expect($application)->email->toBe('hanna@aau.edu.et')
        ->status->toBe('pending')
        ->orcid->toBe('0000-0002-1825-0097')
        ->expertise->toBe(['Soil fertility', 'Agronomy']);
    Storage::disk('private')->assertExists($application->cv_path);
    expect($application->cv_path)->toBe("reviewer-applications/{$application->id}.pdf")
        ->and(DB::table('notifications')->where('notifiable_id', $this->central->id)->where('type', 'reviewer_application_received')->exists())->toBeTrue();
});

test('an application needs a PDF CV, expertise and consent', function () {
    rr_apply(['cv' => UploadedFile::fake()->create('cv.docx', 10)])->assertUnprocessable()->assertJsonValidationErrors('cv');
    rr_apply(['expertise' => []])->assertUnprocessable()->assertJsonValidationErrors('expertise');
    rr_apply(['consent' => '0'])->assertUnprocessable()->assertJsonValidationErrors('consent');
    rr_apply(['website' => 'http://spam.example'])->assertUnprocessable();

    expect(ReviewerApplication::count())->toBe(0);
});

test('people who can already review, and duplicate applications, are turned away', function () {
    $staff = User::factory()->create(['email' => 'staff@wsu.edu.et']);
    $staff->assignRole('staff');
    rr_apply(['email' => 'staff@wsu.edu.et'])->assertUnprocessable();

    rr_apply()->assertCreated();
    rr_apply()->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, 'already being considered'));
});

test('approving creates an external reviewer account who appears in reviewer suggestions', function () {
    rr_apply();
    $application = ReviewerApplication::first();

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/reviewer-applications/{$application->id}/approve", ['expertise' => ['Soil fertility', 'Soil chemistry']])
        ->assertOk();

    $user = User::where('email', 'hanna@aau.edu.et')->first();
    expect($user)->not->toBeNull()
        ->and($user->hasRole('external_reviewer'))->toBeTrue()
        ->and($user->affiliation)->toBe('Addis Ababa University')
        ->and($user->expertise)->toBe(['Soil fertility', 'Soil chemistry'])
        ->and($user->registration_method)->toBe('reviewer_application')
        ->and($application->fresh())->status->toBe('approved')->user_id->toBe($user->id)
        ->and(DB::table('password_reset_tokens')->where('email', $user->email)->exists())->toBeTrue();
});

test('the password link for a new reviewer account works for a week, not just an hour', function () {
    rr_apply();
    $application = ReviewerApplication::first();
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/reviewer-applications/{$application->id}/approve")->assertOk();

    // Replace the emailed token with a known one, issued three days ago.
    DB::table('password_reset_tokens')->where('email', 'hanna@aau.edu.et')
        ->update(['token' => hash('sha256', 'known-token'), 'created_at' => now()->subDays(3)]);

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => 'known-token', 'email' => 'hanna@aau.edu.et', 'password' => 'NewPassw0rd!', 'password_confirmation' => 'NewPassw0rd!',
    ])->assertOk();
});

test('an ordinary password reset link still expires after an hour', function () {
    $user = User::factory()->create(['email' => 'someone@wsu.edu.et']);
    DB::table('password_reset_tokens')->insert(['email' => $user->email, 'token' => hash('sha256', 'old-token'), 'created_at' => now()->subHours(3)]);

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => 'old-token', 'email' => $user->email, 'password' => 'NewPassw0rd!', 'password_confirmation' => 'NewPassw0rd!',
    ])->assertUnprocessable();
});

test('declining needs a reason and does not create an account', function () {
    rr_apply();
    $application = ReviewerApplication::first();

    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/reviewer-applications/{$application->id}/reject")
        ->assertUnprocessable()->assertJsonValidationErrors('note');
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/reviewer-applications/{$application->id}/reject", ['note' => 'Your field is outside our current calls.'])
        ->assertOk();

    expect($application->fresh()->status)->toBe('rejected')
        ->and(User::where('email', 'hanna@aau.edu.et')->exists())->toBeFalse();

    // A decided application can't be decided again.
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/reviewer-applications/{$application->id}/approve")->assertUnprocessable();
});

test('only reviewer recruiters can see applications and CVs', function () {
    rr_apply();
    $application = ReviewerApplication::first();
    $collegeOfficer = User::factory()->create();
    $collegeOfficer->assignRole('college_officer');

    $this->actingAs($collegeOfficer, 'sanctum')->getJson('/api/v1/reviewer-applications')->assertForbidden();
    $this->actingAs($collegeOfficer, 'sanctum')->get("/api/v1/reviewer-applications/{$application->id}/cv")->assertForbidden();
    $this->actingAs($collegeOfficer, 'sanctum')->postJson("/api/v1/reviewer-applications/{$application->id}/approve")->assertForbidden();

    $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/reviewer-applications')
        ->assertOk()->assertJsonPath('data.data.0.name', 'Dr. Hanna Girma')->assertJsonMissingPath('data.data.0.cv_path')
        ->assertJsonPath('meta.counts.pending', 1);
    $this->actingAs($this->central, 'sanctum')->get("/api/v1/reviewer-applications/{$application->id}/cv")->assertOk();
});
