<?php

use App\Jobs\SendRawMailJob;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceRegistration;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();

    $this->admin = User::factory()->create(['status' => 'active']);
    $this->admin->assignRole('super_admin');

    $this->conference = Conference::create([
        'title' => 'Research Week', 'start_date' => now()->addMonth(), 'end_date' => now()->addMonth()->addDays(2),
        'status' => 'published', 'location_type' => 'hybrid', 'virtual_link' => 'https://meet.example.com/secret',
        'abstract_submission_open' => true, 'abstract_deadline' => now()->addWeeks(2), 'created_by' => $this->admin->id,
        'max_capacity' => 2,
    ]);

    $this->abstract = ConferenceAbstract::create([
        'conference_id' => $this->conference->id, 'submitter_name' => 'Jane', 'submitter_email' => 'jane@example.com',
        'title' => 'Soil health', 'body' => str_repeat('word ', 30), 'presentation_type' => 'oral',
        'status' => 'submitted', 'submitted_at' => now(),
    ]);

    $this->reviewer = User::factory()->create(['status' => 'active']);
    $this->reviewer->assignRole('staff');
});

test('only assigned reviewers can review, once, and the committee makes the decision', function () {
    $stranger = User::factory()->create();
    $stranger->assignRole('staff');
    $review = ['score' => 8, 'recommendation' => 'accept', 'comments' => 'Strong'];

    // Not assigned: refused, and nothing changes.
    $this->actingAs($stranger, 'sanctum')->postJson("/api/v1/reviewer/abstracts/{$this->abstract->id}/review", $review)->assertForbidden();

    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/abstracts/{$this->abstract->id}/assign-reviewer", ['reviewer_id' => $this->reviewer->id])->assertOk();
    $this->actingAs($this->reviewer, 'sanctum')->postJson("/api/v1/reviewer/abstracts/{$this->abstract->id}/review", $review)->assertOk();

    // A recommendation does not decide: the status stays with the committee.
    expect($this->abstract->fresh()->status)->toBe('under_review');

    // The review is locked once sent.
    $this->actingAs($this->reviewer, 'sanctum')->postJson("/api/v1/reviewer/abstracts/{$this->abstract->id}/review", ['score' => 1, 'recommendation' => 'reject'])->assertUnprocessable();

    // Re-assigning the same reviewer does not silently wipe their review.
    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/abstracts/{$this->abstract->id}/assign-reviewer", ['reviewer_id' => $this->reviewer->id])
        ->assertUnprocessable()->assertJsonPath('meta.code', 'already_reviewed');

    // It is ready for decision, and the list shows the review count and average.
    $list = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/admin/abstracts?status=ready_for_decision')->assertOk()->json('data');
    expect($list['data'][0]['reviews_done_count'])->toBe(1)
        ->and((float) $list['data'][0]['average_score'])->toBe(8.0)
        ->and($list['counts']['ready_for_decision'])->toBe(1);

    $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$this->abstract->id}/status", ['status' => 'accepted', 'admin_notes' => 'Prepare 15 minutes.'])->assertOk();
    expect($this->abstract->fresh()->status)->toBe('accepted');
});

test('the export works and follows the filters', function () {
    ConferenceAbstract::create([
        'conference_id' => $this->conference->id, 'submitter_name' => 'Draft Person', 'submitter_email' => 'd@example.com',
        'title' => 'Unfinished', 'body' => str_repeat('word ', 30), 'presentation_type' => 'poster', 'status' => 'draft',
    ]);

    $csv = $this->actingAs($this->admin, 'sanctum')->get('/api/v1/admin/abstracts/export')->assertOk()->streamedContent();

    expect($csv)->toContain('Soil health')->not->toContain('Unfinished');
});

test('the tracking token is never exposed, and my-abstracts works only by emailed link', function () {
    // The admin list and the old email lookup do not reveal it.
    $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/admin/abstracts')->assertJsonMissingPath('data.data.0.submission_token');
    $this->getJson('/api/v1/abstracts/mine?email=jane@example.com')->assertForbidden();

    // Asking for the link emails it and answers the same either way.
    $this->postJson('/api/v1/abstracts/mine/link', ['email' => 'jane@example.com'])->assertOk();
    $this->postJson('/api/v1/abstracts/mine/link', ['email' => 'nobody@example.com'])->assertOk();
    Queue::assertPushed(SendRawMailJob::class, fn ($job) => $job->to === 'jane@example.com' && str_contains($job->html, '/my-abstracts?key='));
    Queue::assertNotPushed(SendRawMailJob::class, fn ($job) => $job->to === 'nobody@example.com');

    $job = collect(Queue::pushed(SendRawMailJob::class))->first(fn ($j) => $j->to === 'jane@example.com');
    preg_match('/key=([A-Za-z0-9]+)/', $job->html, $m);

    $mine = $this->getJson('/api/v1/abstracts/mine?key='.$m[1])->assertOk()->json('data');
    expect($mine[0]['submission_token'])->toBe($this->abstract->submission_token);
});

test('a submitted abstract cannot be overwritten through its token, but a requested revision can be resubmitted after the deadline', function () {
    $payload = fn (array $extra = []) => [
        'submitter_name' => 'Jane', 'submitter_email' => 'jane@example.com', 'title' => 'Soil health v2',
        'body' => str_repeat('better ', 30), 'presentation_type' => 'oral', 'action' => 'submit',
        'revision_token' => $this->abstract->submission_token, ...$extra,
    ];

    $this->postJson("/api/v1/conferences/{$this->conference->slug}/abstracts", $payload())->assertUnprocessable();

    $this->abstract->update(['status' => 'revision_requested']);
    $this->conference->update(['abstract_deadline' => now()->subDay()]);
    $this->postJson("/api/v1/conferences/{$this->conference->slug}/abstracts", $payload())->assertOk();
    expect($this->abstract->fresh()->title)->toBe('Soil health v2');
});

test('the public page hides the join link and registration is race-safe, case-insensitive and closed after the event', function () {
    $public = $this->getJson("/api/v1/conferences/{$this->conference->slug}")->assertOk()->json('data');
    expect($public)->not->toHaveKey('virtual_link')
        ->and($public['has_virtual_link'])->toBeTrue();

    $this->postJson("/api/v1/conferences/{$this->conference->slug}/register", ['name' => 'A', 'email' => 'A@Example.com'])->assertCreated();
    $this->postJson("/api/v1/conferences/{$this->conference->slug}/register", ['name' => 'A', 'email' => 'a@example.com'])->assertUnprocessable();
    $this->postJson("/api/v1/conferences/{$this->conference->slug}/register", ['name' => 'B', 'email' => 'b@example.com'])->assertCreated();
    $this->postJson("/api/v1/conferences/{$this->conference->slug}/register", ['name' => 'C', 'email' => 'c@example.com'])
        ->assertUnprocessable()->assertJsonPath('message', 'This conference is fully booked.');

    // Cancelling a registration frees the seat.
    $reg = ConferenceRegistration::where('email', 'b@example.com')->first();
    $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/admin/conferences/{$this->conference->id}/registrations/{$reg->id}", ['status' => 'cancelled'])->assertOk();
    $this->postJson("/api/v1/conferences/{$this->conference->slug}/register", ['name' => 'C', 'email' => 'c@example.com'])->assertCreated();

    $this->conference->update(['start_date' => now()->subDays(3), 'end_date' => now()->subDay()]);
    $this->postJson("/api/v1/conferences/{$this->conference->slug}/register", ['name' => 'D', 'email' => 'd@example.com'])->assertUnprocessable();
});

test('archiving a finished conference does not email a cancellation, and the list carries overall stats', function () {
    ConferenceRegistration::create(['conference_id' => $this->conference->id, 'name' => 'A', 'email' => 'a@example.com', 'status' => 'confirmed', 'registered_at' => now()]);
    $this->conference->update(['start_date' => now()->subDays(3), 'end_date' => now()->subDay()]);

    $this->actingAs($this->admin, 'sanctum')->putJson("/api/v1/admin/conferences/{$this->conference->id}", ['status' => 'archived'])->assertOk();
    Queue::assertNotPushed(SendRawMailJob::class, fn ($job) => str_contains($job->subject, 'Cancelled'));

    $list = $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/admin/conferences')->assertOk()->json('data');
    expect($list['stats']['total'])->toBe(1)
        ->and($list['data'][0]['abstracts_count'])->toBe(1)
        ->and($list['data'][0]['virtual_link'])->toBe('https://meet.example.com/secret');
});

test('an end date before the start is refused when editing, and session speakers must belong to the conference', function () {
    $this->actingAs($this->admin, 'sanctum')->putJson("/api/v1/admin/conferences/{$this->conference->id}", ['end_date' => now()->addDays(2)->toDateTimeString()])
        ->assertUnprocessable()->assertJsonValidationErrors('end_date');

    $other = Conference::create(['title' => 'Other', 'start_date' => now()->addMonths(2), 'status' => 'draft', 'location_type' => 'physical', 'created_by' => $this->admin->id]);
    $foreign = $other->speakers()->create(['name' => 'Not ours']);

    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/conferences/{$this->conference->id}/sessions", [
        'title' => 'Opening', 'starts_at' => now()->addMonth()->toDateTimeString(), 'type' => 'keynote', 'speaker_ids' => [$foreign->id],
    ])->assertUnprocessable()->assertJsonValidationErrors('speaker_ids.0');
});
