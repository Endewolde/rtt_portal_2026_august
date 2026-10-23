<?php

use App\Jobs\SendEmailNotificationJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['mail.default' => 'array']);
});

/** The email the array mailer captured: [subject, html body]. */
function el_sent(): array
{
    $message = Mail::mailer('array')->getSymfonyTransport()->messages()->last()->getOriginalMessage();

    return [$message->getSubject(), $message->getHtmlBody()];
}

test('an email is written in the language the recipient reads the platform in', function () {
    $researcher = User::factory()->create(['name' => 'Almaz', 'locale' => 'am']);

    (new SendEmailNotificationJob($researcher, 'decision_result', [
        'decision' => 'validated', 'title' => 'Soil mapping', 'tracker_number' => 'RES-1',
        'reason' => 'Your proposal has passed the initial validation and will now proceed to the blind review phase.',
    ]))->handle();

    [$subject, $body] = el_sent();
    expect($subject)->toBe('የፕሮፖዛል ውሳኔ: ተረጋግጧል')
        ->and($body)->toContain('ውድ <strong>Almaz</strong>፣')
        ->and($body)->toContain('ፕሮፖዛሉ ተረጋግጧል')
        ->and($body)->toContain('ፕሮፖዛልዎ የመጀመሪያውን ማረጋገጫ አልፏል')
        ->and($body)->toContain('lang="am"')
        ->and(app()->getLocale())->toBe('en');
});

test('without a saved language the email is in English, and names are escaped', function () {
    $researcher = User::factory()->create(['name' => '<b>Abebe</b>']);

    (new SendEmailNotificationJob($researcher, 'submission_success', ['title' => 'Soil mapping', 'tracker_number' => 'RES-1']))->handle();

    [$subject, $body] = el_sent();
    expect($subject)->toBe('Proposal Submitted Successfully — RES-1')
        ->and($body)->toContain('Dear <strong>&lt;b&gt;Abebe&lt;/b&gt;</strong>,')
        ->and($body)->toContain('successfully submitted');
});

test('the language chosen in the interface is remembered on the account', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->withHeader('X-Locale', 'am')->getJson('/api/v1/auth/me')->assertOk();
    expect($user->fresh()->locale)->toBe('am');

    $this->actingAs($user, 'sanctum')->withHeader('X-Locale', 'xx')->getJson('/api/v1/auth/me')->assertOk();
    expect($user->fresh()->locale)->toBe('am');
});
