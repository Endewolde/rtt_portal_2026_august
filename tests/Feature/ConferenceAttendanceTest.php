<?php

use App\Jobs\SendRawMailJob;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\ConferenceCertificate;
use App\Models\ConferenceRegistration;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
    $this->conference = Conference::create([
        'title' => 'Research Week', 'slug' => 'research-week', 'start_date' => now()->addMonth(), 'end_date' => now()->addMonth()->addDay(),
        'status' => 'published', 'created_by' => $this->admin->id, 'location_type' => 'physical', 'location_address' => 'Main Campus',
    ]);
});

function ca_setup(object $ctx, array $setup): void
{
    $ctx->actingAs($ctx->admin, 'sanctum')->putJson("/api/v1/admin/conferences/{$ctx->conference->id}", $setup)->assertOk();
    $ctx->conference->refresh();
}

function ca_register(object $ctx, string $email, array $extra = [])
{
    return test()->postJson('/api/v1/conferences/research-week/register', ['name' => ucfirst(strtok($email, '@')), 'email' => $email, ...$extra]);
}

test('registration asks for a type and the organiser\'s questions, and keeps the labelled answers', function () {
    ca_setup($this, [
        'registration_types' => [['name' => 'Participant'], ['name' => 'Student', 'capacity' => 50]],
        'registration_questions' => [
            ['id' => 'diet', 'label' => 'Dietary needs', 'type' => 'select', 'options' => ['None', 'Vegetarian'], 'required' => true],
            ['id' => 'photo', 'label' => 'I agree to be photographed', 'type' => 'checkbox', 'required' => false],
        ],
    ]);
    $student = $this->conference->registrationTypes->firstWhere('name', 'Student');

    ca_register($this, 'abebe@example.com')->assertUnprocessable()->assertJsonValidationErrors(['registration_type_id', 'answers.diet']);
    ca_register($this, 'abebe@example.com', ['registration_type_id' => $student->id, 'answers' => ['diet' => 'Pizza']])->assertJsonValidationErrors(['answers.diet']);

    $res = ca_register($this, 'abebe@example.com', ['registration_type_id' => $student->id, 'answers' => ['diet' => 'Vegetarian', 'photo' => true, 'sneaky' => 'x']])->assertCreated();

    $reg = ConferenceRegistration::firstWhere('email', 'abebe@example.com');
    expect($reg->registration_type_id)->toBe($student->id)
        ->and($reg->answers)->toBe([['id' => 'diet', 'label' => 'Dietary needs', 'value' => 'Vegetarian'], ['id' => 'photo', 'label' => 'I agree to be photographed', 'value' => true]])
        ->and($reg->ticket_code)->toHaveLength(10)
        ->and($res->json('data.ticket_code'))->toBe($reg->ticket_code);
    Queue::assertPushed(SendRawMailJob::class, fn ($job) => $job->to === 'abebe@example.com' && str_contains($job->html, '/conferences/ticket/'.$reg->ticket_code));
});

test('a full type puts people on the waiting list, and a cancellation moves the first of them up', function () {
    ca_setup($this, ['registration_types' => [['name' => 'Workshop', 'capacity' => 1]]]);
    $type = $this->conference->registrationTypes->first()->id;

    ca_register($this, 'first@example.com', ['registration_type_id' => $type])->assertCreated();
    ca_register($this, 'second@example.com', ['registration_type_id' => $type])->assertCreated()->assertJsonPath('data.status', 'waitlisted');
    ca_register($this, 'third@example.com', ['registration_type_id' => $type])->assertCreated();

    $second = ConferenceRegistration::firstWhere('email', 'second@example.com');
    $this->getJson("/api/v1/conference-tickets/{$second->ticket_code}")->assertOk()
        ->assertJsonPath('data.waitlist_position', 1)->assertJsonPath('data.qr', null);

    $first = ConferenceRegistration::firstWhere('email', 'first@example.com');
    $this->postJson("/api/v1/conference-tickets/{$first->ticket_code}/cancel")->assertOk();

    expect($second->fresh()->status)->toBe('confirmed')
        ->and(ConferenceRegistration::firstWhere('email', 'third@example.com')->status)->toBe('waitlisted');
    Queue::assertPushed(SendRawMailJob::class, fn ($job) => $job->to === 'second@example.com' && str_contains($job->subject, 'A place opened up'));
});

test('without a waiting list a full conference turns people away', function () {
    ca_setup($this, ['waitlist_enabled' => false]);
    $this->conference->update(['max_capacity' => 1]);

    ca_register($this, 'first@example.com')->assertCreated();
    ca_register($this, 'second@example.com')->assertUnprocessable()->assertJsonPath('message', 'This conference is fully booked.');
});

test('the check-in desk admits a confirmed ticket once, warns on repeats and refuses waitlisted ones', function () {
    $this->conference->update(['max_capacity' => 1]);
    ca_register($this, 'first@example.com');
    ca_register($this, 'second@example.com');
    [$ok, $waiting] = [ConferenceRegistration::firstWhere('email', 'first@example.com'), ConferenceRegistration::firstWhere('email', 'second@example.com')];
    $desk = fn (string $code) => $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/conferences/{$this->conference->id}/check-in", ['code' => $code]);

    // A scanned link or lower-case typing still finds the ticket.
    $desk('https://rtt.example/conferences/ticket/'.strtolower($ok->ticket_code))->assertOk()->assertJsonPath('meta.code', 'checked_in');
    $desk($ok->ticket_code)->assertOk()->assertJsonPath('meta.code', 'already');
    $desk($waiting->ticket_code)->assertUnprocessable()->assertJsonPath('meta.code', 'not_confirmed');
    $desk('NOPE123456')->assertNotFound();

    expect($ok->fresh()->checked_in_at)->not->toBeNull()
        ->and($this->postJson("/api/v1/conference-tickets/{$ok->ticket_code}/cancel")->status())->toBe(422);
});

test('certificates go to attendees who checked in, presenters and reviewers — once each — and verify publicly', function () {
    ca_register($this, 'came@example.com');
    ca_register($this, 'stayed-home@example.com');
    ConferenceRegistration::firstWhere('email', 'came@example.com')->update(['checked_in_at' => now()]);
    $abstract = ConferenceAbstract::create([
        'conference_id' => $this->conference->id, 'submitter_name' => 'Sara', 'submitter_email' => 'sara@example.com', 'submitter_presenting' => true,
        'title' => 'Malaria trends', 'body' => 'Body text here.', 'presentation_type' => 'oral', 'accepted_type' => 'poster', 'status' => 'accepted', 'submitted_at' => now(),
    ]);
    $reviewer = User::factory()->create(['email' => 'rev@example.com']);
    ConferenceAbstractReview::create(['abstract_id' => $abstract->id, 'reviewer_id' => $reviewer->id, 'score' => 8, 'recommendation' => 'accept', 'submitted_at' => now()]);

    $issue = fn () => $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/conferences/{$this->conference->id}/certificates", ['kinds' => ['attendance', 'presentation', 'reviewer']]);
    $issue()->assertOk()->assertJsonPath('data', ['attendance' => 1, 'presentation' => 1, 'reviewer' => 1]);
    $issue()->assertOk()->assertJsonPath('data', ['attendance' => 0, 'presentation' => 0, 'reviewer' => 0]);

    $presentation = ConferenceCertificate::firstWhere('kind', 'presentation');
    expect($presentation->recipient_name)->toBe('Sara')->and($presentation->detail)->toBe('Malaria trends (poster)');
    Queue::assertPushed(SendRawMailJob::class, fn ($job) => $job->to === 'sara@example.com' && str_contains($job->html, "/conference-certificates/{$presentation->code}/pdf"));

    $this->get("/api/v1/conference-certificates/{$presentation->code}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
    $this->getJson("/api/v1/certificates/verify/{$presentation->code}")->assertOk()
        ->assertJsonPath('data.kind', 'conference')->assertJsonPath('data.status', 'valid')->assertJsonPath('data.conference', 'Research Week');

    $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/admin/conferences/{$this->conference->id}/certificates/{$presentation->id}", ['revoked' => true])->assertOk();
    $this->getJson("/api/v1/certificates/verify/{$presentation->code}")->assertJsonPath('data.status', 'revoked');
    $this->get("/api/v1/conference-certificates/{$presentation->code}/pdf")->assertNotFound();
});

test('attendees rate the conference once feedback opens and organisers see the results without names', function () {
    ca_register($this, 'a@example.com');
    $reg = ConferenceRegistration::firstWhere('email', 'a@example.com');

    $this->postJson("/api/v1/conference-tickets/{$reg->ticket_code}/feedback", ['rating' => 5])->assertUnprocessable();
    ca_setup($this, ['feedback_open' => true]);
    $this->postJson("/api/v1/conference-tickets/{$reg->ticket_code}/feedback", ['rating' => 4, 'would_recommend' => true, 'liked' => 'Great keynote'])->assertOk();
    $this->postJson("/api/v1/conference-tickets/{$reg->ticket_code}/feedback", ['rating' => 5, 'would_recommend' => true])->assertOk();

    $summary = $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/admin/conferences/{$this->conference->id}/feedback")->assertOk();
    expect($summary->json('data.responses'))->toBe(1)
        ->and($summary->json('data.average'))->toEqual(5)
        ->and($summary->json('data.recommend_pct'))->toBe(100)
        ->and($summary->getContent())->not->toContain('a@example.com');
});
