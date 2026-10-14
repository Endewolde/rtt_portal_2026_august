<?php

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendRawMailJob;
use App\Models\EmailLog;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('a delivered notification email is logged with its type and subject', function () {
    $user = User::factory()->create(['email' => 'pi@example.com']);

    (new SendEmailNotificationJob($user, 'approval_report_submitted', ['tracker_number' => 'TRK-9', 'message' => 'Flagged.']))->handle();

    $log = EmailLog::first();
    expect($log->status)->toBe('sent')
        ->and($log->to_email)->toBe('pi@example.com')
        ->and($log->source)->toBe('approval_report_submitted')
        ->and($log->subject)->toContain('TRK-9');
});

test('a failed email is logged with the error and still reported to the caller', function () {
    Mail::shouldReceive('html')->once()->andThrow(new RuntimeException('Connection to SMTP server refused'));

    expect(fn () => (new SendRawMailJob('<p>Hi</p>', 'reviewer@example.com', 'Reviewer', 'Review Assignment — TRK-1'))->handle())
        ->toThrow(RuntimeException::class);

    $log = EmailLog::first();
    expect($log->status)->toBe('failed')
        ->and($log->to_email)->toBe('reviewer@example.com')
        ->and($log->error)->toContain('SMTP server refused');
});

test('system monitor shows the email log with delivery figures', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    EmailLog::sent('a@example.com', 'Hello', 'decision_result');
    EmailLog::failed('b@example.com', 'Hello', 'decision_result', new RuntimeException('boom'));

    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/system-monitor/email-log')
        ->assertOk()
        ->assertJsonPath('meta.stats.sent_24h', 1)
        ->assertJsonPath('meta.stats.failed_24h', 1)
        ->assertJsonPath('data.total', 2);

    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/system-monitor/email-log?status=failed')
        ->assertJsonPath('data.total', 1)
        ->assertJsonPath('data.data.0.error', 'boom');
});

test('staff cannot read the email log', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->getJson('/api/v1/system-monitor/email-log')
        ->assertForbidden();
});
