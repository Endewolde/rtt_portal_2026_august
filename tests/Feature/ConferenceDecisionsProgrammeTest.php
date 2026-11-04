<?php

use App\Jobs\SendRawMailJob;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceSession;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
    $this->conference = Conference::create([
        'title' => 'Research Week', 'slug' => 'research-week', 'start_date' => now()->addMonth(), 'end_date' => now()->addMonth()->addDay(),
        'status' => 'published', 'created_by' => $this->admin->id, 'abstract_submission_open' => true, 'location_type' => 'physical',
        'location_address' => 'Main Campus, Wolaita Sodo',
    ]);
});

function cdp_abstract(object $ctx, array $overrides = []): ConferenceAbstract
{
    static $n = 0;
    $n++;

    return ConferenceAbstract::create([
        'conference_id' => $ctx->conference->id, 'submitter_name' => "Author {$n}", 'submitter_email' => "author{$n}@example.com",
        'title' => "Study number {$n}", 'body' => str_repeat('Findings. ', 10), 'presentation_type' => 'oral',
        'status' => 'under_review', 'submitted_at' => now(), 'submitter_presenting' => false,
        'co_authors' => [['name' => "Presenter {$n}", 'email' => "presenter{$n}@example.com", 'presenting' => true]],
        ...$overrides,
    ]);
}

function cdp_session(object $ctx, array $overrides = []): ConferenceSession
{
    return ConferenceSession::create([
        'conference_id' => $ctx->conference->id, 'title' => 'Soil and water', 'type' => 'talk', 'room' => 'Hall A', 'chair' => 'Prof. Tesfaye',
        'starts_at' => now()->addMonth()->setTime(9, 0), 'ends_at' => now()->addMonth()->setTime(10, 30),
        ...$overrides,
    ]);
}

test('a bulk decision personalises the message for each submitter, emails each once and skips withdrawn abstracts', function () {
    [$a, $b] = [cdp_abstract($this), cdp_abstract($this)];
    $withdrawn = cdp_abstract($this, ['status' => 'withdrawn']);

    $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/admin/abstracts/bulk-decision', [
        'ids' => [$a->id, $b->id, $withdrawn->id], 'status' => 'accepted', 'accepted_type' => 'poster',
        'admin_notes' => 'Dear {name}, "{title}" will be a {type} at {conference}.',
    ])->assertOk()->assertJsonPath('data.changed', 2)->assertJsonPath('data.skipped', 1);

    expect($a->fresh()->admin_notes)->toBe("Dear {$a->submitter_name}, \"{$a->title}\" will be a Poster at Research Week.")
        ->and($a->fresh()->accepted_type)->toBe('poster')
        ->and($a->fresh()->decided_at)->not->toBeNull()
        ->and($withdrawn->fresh()->status)->toBe('withdrawn');
    Queue::assertPushed(SendRawMailJob::class, 2);
    Queue::assertPushed(SendRawMailJob::class, fn ($job) => $job->to === $a->submitter_email && str_contains($job->html, '/abstracts/letter/'));
});

test('accepting in the format asked for records no change of format', function () {
    $abstract = cdp_abstract($this);

    $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$abstract->id}/status", [
        'status' => 'accepted', 'accepted_type' => 'oral', 'admin_notes' => 'Welcome.',
    ])->assertOk();

    expect($abstract->fresh()->accepted_type)->toBeNull();
});

test('the letter of acceptance is a PDF for accepted abstracts only, for the committee and the author', function () {
    $accepted = cdp_abstract($this, ['status' => 'accepted']);
    $pending = cdp_abstract($this);

    $this->actingAs($this->admin, 'sanctum')->get("/api/v1/admin/abstracts/{$accepted->id}/letter")
        ->assertOk()->assertHeader('content-type', 'application/pdf');
    $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/admin/abstracts/{$pending->id}/letter")->assertUnprocessable();

    $this->get("/api/v1/abstracts/letter/{$accepted->submission_token}")->assertOk()->assertHeader('content-type', 'application/pdf');
    $this->get("/api/v1/abstracts/letter/{$pending->submission_token}")->assertNotFound();
});

test('accepted authors upload a final version until the deadline', function () {
    Storage::fake('public');
    $accepted = cdp_abstract($this, ['status' => 'accepted']);
    $pending = cdp_abstract($this);
    $file = fn () => UploadedFile::fake()->create('paper.pdf', 300, 'application/pdf');

    $this->post("/api/v1/abstracts/camera-ready/{$accepted->submission_token}", ['file' => $file()], ['Accept' => 'application/json'])->assertOk();
    expect($accepted->fresh()->camera_ready_path)->not->toBeNull()->and($accepted->fresh()->camera_ready_at)->not->toBeNull();

    $this->post("/api/v1/abstracts/camera-ready/{$pending->submission_token}", ['file' => $file()], ['Accept' => 'application/json'])->assertUnprocessable();

    $this->conference->update(['camera_ready_deadline' => now()->subDay()]);
    $this->post("/api/v1/abstracts/camera-ready/{$accepted->submission_token}", ['file' => $file()], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, 'deadline'));
});

test('accepted abstracts are placed in this conference\'s sessions and the public programme shows the presenter, not emails', function () {
    $abstract = cdp_abstract($this, ['status' => 'accepted']);
    $session = cdp_session($this);
    $other = Conference::create(['title' => 'Other', 'start_date' => now(), 'end_date' => now(), 'status' => 'published', 'created_by' => $this->admin->id, 'location_type' => 'virtual']);
    $foreign = cdp_session($this, ['conference_id' => $other->id]);

    $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$abstract->id}/schedule", ['session_id' => $foreign->id])->assertUnprocessable();
    $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$abstract->id}/schedule", ['session_id' => $session->id])->assertOk();
    expect($abstract->fresh()->session_order)->toBe(1);

    $public = $this->getJson('/api/v1/conferences/research-week')->assertOk();
    expect($public->json('data.sessions.0.abstracts.0'))->toMatchArray(['title' => $abstract->title, 'presenter' => $abstract->co_authors[0]['name'], 'type' => 'oral'])
        ->and($public->getContent())->not->toContain('@example.com');

    $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$abstract->id}/status", ['status' => 'rejected'])->assertOk();
    expect($abstract->fresh()->session_id)->toBeNull();
});

test('the programme downloads as an iCalendar file, whole or one session', function () {
    $session = cdp_session($this, ['title' => 'Opening; welcome, all']);

    $whole = $this->get('/api/v1/conferences/research-week/calendar.ics')->assertOk();
    expect($whole->headers->get('content-type'))->toContain('text/calendar')
        ->and(substr_count($whole->getContent(), 'BEGIN:VEVENT'))->toBe(2)
        ->and($whole->getContent())->toContain('SUMMARY:Opening\; welcome\, all')->toContain('LOCATION:Hall A');

    $one = $this->get("/api/v1/conferences/research-week/calendar.ics?session={$session->id}")->assertOk();
    expect(substr_count($one->getContent(), 'BEGIN:VEVENT'))->toBe(1);
});
