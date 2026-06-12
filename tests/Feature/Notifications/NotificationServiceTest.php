<?php

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendTelegramNotificationJob;
use App\Jobs\StoreInAppNotificationJob;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Services\NotificationService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Queue::fake();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notif_makeUser(array $attrs = []): User
{
    $user = User::factory()->create(array_merge(['email' => 'user'.rand().'@test.com'], $attrs));
    NotificationPreference::create([
        'user_id'          => $user->id,
        'email_enabled'    => true,
        'telegram_enabled' => true,
        'inapp_enabled'    => true,
    ]);

    return $user;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('email job dispatched when email_enabled = true', function () {
    $user = notif_makeUser(['email' => 'test@rtt.edu']);

    app(NotificationService::class)->send('submission_success', $user, ['tracker_number' => 'RES-2026-000001']);

    Queue::assertPushed(SendEmailNotificationJob::class, fn ($job) => $job->recipient->id === $user->id);
});

test('email job NOT dispatched when email_enabled = false', function () {
    $user = notif_makeUser(['email' => 'test2@rtt.edu']);
    NotificationPreference::where('user_id', $user->id)->update(['email_enabled' => false]);

    app(NotificationService::class)->send('submission_success', $user, []);

    Queue::assertNotPushed(SendEmailNotificationJob::class);
});

test('telegram job NOT dispatched when user has no telegram_chat_id', function () {
    $user = notif_makeUser(['telegram_chat_id' => null]);

    app(NotificationService::class)->send('review_assignment', $user, []);

    Queue::assertNotPushed(SendTelegramNotificationJob::class);
});

test('telegram job dispatched when user has telegram_chat_id and telegram_enabled = true', function () {
    $user = notif_makeUser(['telegram_chat_id' => '123456789']);

    app(NotificationService::class)->send('review_assignment', $user, ['tracker_number' => 'RES-2026-000001']);

    Queue::assertPushed(SendTelegramNotificationJob::class, fn ($job) => $job->chatId === '123456789');
});

test('in-app notification stored in notifications table', function () {
    $user = notif_makeUser();

    $job = new StoreInAppNotificationJob($user->id, 'award_approval', ['grant_reference' => 'GRANT-2026-000001']);
    $job->handle();

    $record = \Illuminate\Support\Facades\DB::table('notifications')
        ->where('notifiable_id', $user->id)
        ->where('type', 'award_approval')
        ->first();

    expect($record)->not->toBeNull()
        ->and($record->notifiable_type)->toBe(User::class)
        ->and(json_decode($record->data, true)['grant_reference'])->toBe('GRANT-2026-000001')
        ->and($record->read_at)->toBeNull();
});

test('all jobs dispatched to correct queue (notifications queue)', function () {
    $user = notif_makeUser(['email' => 'q@rtt.edu', 'telegram_chat_id' => '999']);

    app(NotificationService::class)->send('submission_success', $user, []);

    Queue::assertPushedOn('notifications', SendEmailNotificationJob::class);
    Queue::assertPushedOn('notifications', SendTelegramNotificationJob::class);
    Queue::assertPushedOn('notifications', StoreInAppNotificationJob::class);
});

test('sendToMany dispatches to each recipient', function () {
    $user1 = notif_makeUser(['email' => 'u1@rtt.edu']);
    $user2 = notif_makeUser(['email' => 'u2@rtt.edu']);
    $user3 = notif_makeUser(['email' => 'u3@rtt.edu']);

    app(NotificationService::class)->sendToMany('deadline_reminder', [$user1, $user2, $user3], ['days_remaining' => 3]);

    Queue::assertPushed(SendEmailNotificationJob::class, 3);
    Queue::assertPushed(StoreInAppNotificationJob::class, 3);
});
