<?php

use App\Jobs\StoreInAppNotificationJob;
use App\Models\AppSetting;
use App\Models\User;
use App\Services\SmsService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function sms_setting(string $key, string $value): void
{
    AppSetting::updateOrCreate(['key' => $key], ['value' => $value, 'type' => 'string', 'group' => 'email']);
    Cache::forget(SmsService::CACHE_KEY);
}

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    sms_setting('sms_enabled', 'true');
    sms_setting('africastalking_username', 'sandbox');
    sms_setting('africastalking_api_key', 'test-key');
    sms_setting('sms_events', 'award_approval,decision_result');
    sms_setting('system_name', 'WSU RTT');
    Http::fake(['*africastalking.com/*' => Http::response(['SMSMessageData' => ['Recipients' => [['statusCode' => 101, 'status' => 'Success']]]], 201)]);
    $this->pi = User::factory()->create(['phone' => '0911 234 567', 'status' => 'active']);
});

test('Ethiopian phone numbers are put in international form', function () {
    expect(SmsService::normalize('0911234567'))->toBe('+251911234567')
        ->and(SmsService::normalize('911234567'))->toBe('+251911234567')
        ->and(SmsService::normalize('251911234567'))->toBe('+251911234567')
        ->and(SmsService::normalize('+254712345678'))->toBe('+254712345678')
        ->and(SmsService::normalize('12345'))->toBeNull()
        ->and(SmsService::normalize(null))->toBeNull();
});

test('an important event also goes out by SMS, through the sandbox gateway', function () {
    StoreInAppNotificationJob::dispatchSync($this->pi->id, 'award_approval', ['message' => 'Your proposal RES-1 has been funded.']);

    Http::assertSent(fn (Request $r) => str_contains($r->url(), 'api.sandbox.africastalking.com')
        && $r['to'] === '+251911234567'
        && $r['message'] === 'WSU RTT: Your proposal RES-1 has been funded.'
        && $r->header('apiKey')[0] === 'test-key');
});

test('no SMS for routine events, people who switched it off, or when SMS is off', function () {
    StoreInAppNotificationJob::dispatchSync($this->pi->id, 'submission_success', ['message' => 'Submitted.']);

    DB::table('notification_preferences')->insert(['id' => (string) Str::uuid(), 'user_id' => $this->pi->id, 'sms_enabled' => false, 'created_at' => now(), 'updated_at' => now()]);
    StoreInAppNotificationJob::dispatchSync($this->pi->id, 'award_approval', ['message' => 'Funded.']);

    $other = User::factory()->create(['phone' => '0922 000 111', 'status' => 'active']);
    sms_setting('sms_enabled', 'false');
    StoreInAppNotificationJob::dispatchSync($other->id, 'award_approval', ['message' => 'Funded.']);

    Http::assertNothingSent();
});

test('an event without its own message is texted with its email subject', function () {
    StoreInAppNotificationJob::dispatchSync($this->pi->id, 'decision_result', ['decision' => 'approved']);

    Http::assertSent(fn (Request $r) => $r['message'] === 'WSU RTT: Proposal Decision: Approved');
});

test('administrators can send a test SMS, and a gateway refusal is reported', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $this->actingAs($admin, 'sanctum')->postJson('/api/v1/settings/test-sms', ['phone' => '0911234567'])
        ->assertOk()->assertJsonPath('message', 'Test SMS sent to +251911234567.');

    // A fresh fake: the gateway now refuses the number.
    Http::swap(new Factory);
    Http::fake(['*' => Http::response(['SMSMessageData' => ['Recipients' => [['statusCode' => 403, 'status' => 'InvalidPhoneNumber']]]], 201)]);
    $this->postJson('/api/v1/settings/test-sms', ['phone' => '0911234567'])->assertUnprocessable();
    $this->postJson('/api/v1/settings/test-sms', ['phone' => 'abc'])->assertUnprocessable();
});

test('people switch SMS off for themselves', function () {
    $this->actingAs($this->pi, 'sanctum')->putJson('/api/v1/notification-preferences', ['sms_enabled' => false])
        ->assertOk()->assertJsonPath('data.sms_enabled', false);
});
