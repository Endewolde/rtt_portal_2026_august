<?php

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendRawMailJob;
use App\Models\NotificationPreference;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function digest_user(string $frequency = 'realtime'): User
{
    $user = User::factory()->create(['email' => 'digest'.rand().'@rtt.edu']);
    NotificationPreference::create([
        'user_id' => $user->id,
        'email_enabled' => true,
        'telegram_enabled' => false,
        'inapp_enabled' => true,
        'digest_frequency' => $frequency,
    ]);

    return $user;
}

function digest_notification(User $user, string $type = 'award_approval', ?string $createdAt = null): void
{
    DB::table('notifications')->insert([
        'id' => (string) Str::orderedUuid(),
        'notifiable_type' => User::class,
        'notifiable_id' => $user->id,
        'type' => $type,
        'data' => json_encode(['tracker_number' => 'RES-2026-000001', 'title' => 'Sample Proposal']),
        'read_at' => null,
        'created_at' => $createdAt ?? now(),
    ]);
}

// ─── SendEmailNotificationJob digest guard ─────────────────────────────────────

// SendEmailNotificationJob sends via the raw Mail::send($view, ...) API, which
// Mail::fake()'s MailFake silently no-ops for non-Mailable views without recording
// it — so assertSent()/assertNothingSent() can't observe it either way. Mail::spy()
// intercepts at the facade call level instead, so it actually distinguishes the two paths.

test('a realtime user still receives the individual email', function () {
    Mail::spy();
    $user = digest_user('realtime');

    (new SendEmailNotificationJob($user, 'submission_success', ['tracker_number' => 'RES-2026-000001']))->handle();

    Mail::shouldHaveReceived('send')->once();
});

test('a daily-digest user does not receive the individual real-time email', function () {
    Mail::spy();
    $user = digest_user('daily');

    (new SendEmailNotificationJob($user, 'submission_success', ['tracker_number' => 'RES-2026-000001']))->handle();

    Mail::shouldNotHaveReceived('send');
});

test('a weekly-digest user does not receive the individual real-time email', function () {
    Mail::spy();
    $user = digest_user('weekly');

    (new SendEmailNotificationJob($user, 'submission_success', ['tracker_number' => 'RES-2026-000001']))->handle();

    Mail::shouldNotHaveReceived('send');
});

test('a user with no preference row at all still gets real-time email (default behavior)', function () {
    Mail::spy();
    $user = User::factory()->create(['email' => 'nopref@rtt.edu']);

    (new SendEmailNotificationJob($user, 'submission_success', []))->handle();

    Mail::shouldHaveReceived('send')->once();
});

// ─── notification-preferences endpoints ────────────────────────────────────────

test('a user can fetch their own notification preferences, created on first access', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/notification-preferences')
        ->assertOk();

    expect($response->json('data.digest_frequency'))->toBe('realtime')
        ->and(NotificationPreference::where('user_id', $user->id)->exists())->toBeTrue();
});

test('a user can switch to a daily digest', function () {
    $user = digest_user('realtime');

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/v1/notification-preferences', ['digest_frequency' => 'daily'])
        ->assertOk()
        ->assertJsonPath('data.digest_frequency', 'daily');

    expect(NotificationPreference::where('user_id', $user->id)->value('digest_frequency'))->toBe('daily');
});

test('an invalid digest frequency is rejected', function () {
    $user = digest_user('realtime');

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/v1/notification-preferences', ['digest_frequency' => 'hourly'])
        ->assertStatus(422);
});

// ─── notifications:send-digests command ────────────────────────────────────────

test('digest command emails a summary to a daily user with new notifications', function () {
    Bus::fake();
    $user = digest_user('daily');
    digest_notification($user);
    digest_notification($user, 'review_assignment');

    $this->artisan('notifications:send-digests', ['frequency' => 'daily'])
        ->assertSuccessful();

    Bus::assertDispatched(SendRawMailJob::class, fn ($job) => $job->to === $user->email && str_contains($job->subject, '2 update'));
    expect(NotificationPreference::where('user_id', $user->id)->value('last_digest_sent_at'))->not->toBeNull();
});

test('digest command skips a user with nothing new since their last digest', function () {
    Bus::fake();
    $user = digest_user('daily');
    NotificationPreference::where('user_id', $user->id)->update(['last_digest_sent_at' => now()]);
    digest_notification($user, 'award_approval', now()->subMinutes(30)->toDateTimeString());

    $this->artisan('notifications:send-digests', ['frequency' => 'daily'])
        ->assertSuccessful();

    Bus::assertNotDispatched(SendRawMailJob::class);
});

test('digest command only processes users matching the requested frequency', function () {
    Bus::fake();
    $dailyUser = digest_user('daily');
    $weeklyUser = digest_user('weekly');
    digest_notification($dailyUser);
    digest_notification($weeklyUser);

    $this->artisan('notifications:send-digests', ['frequency' => 'daily'])->assertSuccessful();

    Bus::assertDispatched(SendRawMailJob::class, fn ($job) => $job->to === $dailyUser->email);
    Bus::assertNotDispatched(SendRawMailJob::class, fn ($job) => $job->to === $weeklyUser->email);
});

test('digest command rejects an invalid frequency argument', function () {
    $this->artisan('notifications:send-digests', ['frequency' => 'hourly'])
        ->assertFailed();
});
