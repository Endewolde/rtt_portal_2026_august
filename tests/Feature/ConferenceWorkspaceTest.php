<?php

use App\Jobs\SendRawMailJob;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceCommitteeMember;
use App\Models\ConferenceRegistration;
use App\Models\ConferenceTrack;
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
    $this->other = Conference::create(['title' => 'Other', 'start_date' => now()->addMonth(), 'status' => 'published', 'created_by' => $this->admin->id, 'location_type' => 'virtual']);
    $this->health = ConferenceTrack::create(['conference_id' => $this->conference->id, 'name' => 'Health']);
    $this->farming = ConferenceTrack::create(['conference_id' => $this->conference->id, 'name' => 'Farming']);
});

function cw_abstract(Conference $conference, array $overrides = []): ConferenceAbstract
{
    return ConferenceAbstract::create([
        'conference_id' => $conference->id, 'submitter_name' => 'Hana Girma', 'submitter_email' => 'hana@example.com', 'submitter_affiliation' => 'WSU',
        'title' => 'A study', 'body' => 'Findings.', 'presentation_type' => 'oral', 'status' => 'under_review', 'submitted_at' => now(),
        ...$overrides,
    ]);
}

function cw_member(object $ctx, string $role, ?string $trackId = null, ?Conference $conference = null): User
{
    $user = User::factory()->create(['status' => 'active']);
    ConferenceCommitteeMember::create(['conference_id' => ($conference ?? $ctx->conference)->id, 'user_id' => $user->id, 'role' => $role, 'track_id' => $trackId]);

    return $user;
}

test('a track chair sees and staffs only their track, and cannot decide', function () {
    $mine = cw_abstract($this->conference, ['track_id' => $this->health->id, 'title' => 'Malaria']);
    $notMine = cw_abstract($this->conference, ['track_id' => $this->farming->id, 'title' => 'Teff']);
    cw_abstract($this->other, ['title' => 'Elsewhere']);
    $chair = cw_member($this, 'track_chair', $this->health->id);
    $reviewer = User::factory()->create(['status' => 'active']);

    $list = $this->actingAs($chair, 'sanctum')->getJson('/api/v1/admin/abstracts')->assertOk();
    expect(collect($list->json('data.data'))->pluck('title')->all())->toBe(['Malaria'])
        ->and($list->json('data.counts.total'))->toBe(1);

    $this->actingAs($chair, 'sanctum')->getJson("/api/v1/admin/abstracts/{$mine->id}")->assertOk()->assertJsonPath('data.can_decide', false);
    $this->actingAs($chair, 'sanctum')->getJson("/api/v1/admin/abstracts/{$notMine->id}")->assertForbidden();
    $this->actingAs($chair, 'sanctum')->postJson("/api/v1/admin/abstracts/{$mine->id}/assign-reviewer", ['reviewer_id' => $reviewer->id])->assertOk();
    $this->actingAs($chair, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$mine->id}/status", ['status' => 'rejected'])->assertForbidden();
    $this->actingAs($chair, 'sanctum')->getJson("/api/v1/admin/conferences/{$this->conference->id}/attendance")->assertForbidden();
});

test('a conference chair runs their own conference but no other', function () {
    $abstract = cw_abstract($this->conference);
    $elsewhere = cw_abstract($this->other);
    $chair = cw_member($this, 'chair');

    $this->actingAs($chair, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$abstract->id}/status", ['status' => 'rejected'])->assertOk();
    $this->actingAs($chair, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$elsewhere->id}/status", ['status' => 'rejected'])->assertForbidden();
    $this->actingAs($chair, 'sanctum')->postJson('/api/v1/admin/abstracts/bulk-decision', ['ids' => [$elsewhere->id], 'status' => 'rejected'])
        ->assertOk()->assertJsonPath('data.changed', 0);
    expect($elsewhere->fresh()->status)->toBe('under_review');

    $this->actingAs($chair, 'sanctum')->getJson("/api/v1/admin/conferences/{$this->conference->id}/overview")->assertOk();
    $this->actingAs($chair, 'sanctum')->getJson("/api/v1/admin/conferences/{$this->other->id}/overview")->assertForbidden();
    expect(collect($this->actingAs($chair, 'sanctum')->getJson('/api/v1/admin/conferences')->assertOk()->json('data.data'))->pluck('id')->all())
        ->toBe([$this->conference->id]);
    // Copying makes a new conference, which is for organisers.
    $this->actingAs($chair, 'sanctum')->postJson("/api/v1/admin/conferences/{$this->conference->id}/duplicate")->assertForbidden();
});

test('desk staff check people in and see the conference without managing it', function () {
    $desk = cw_member($this, 'checkin');
    $reg = ConferenceRegistration::create(['conference_id' => $this->conference->id, 'name' => 'Abel', 'email' => 'abel@example.com', 'status' => 'confirmed', 'registered_at' => now()]);

    $this->actingAs($desk, 'sanctum')->postJson("/api/v1/admin/conferences/{$this->conference->id}/check-in", ['code' => $reg->ticket_code])->assertOk();
    $this->actingAs($desk, 'sanctum')->getJson("/api/v1/admin/conferences/{$this->conference->id}")->assertOk()
        ->assertJsonPath('data.my_access', ['manages' => false, 'checks_in' => true, 'organiser' => false]);
    $this->actingAs($desk, 'sanctum')->postJson("/api/v1/admin/conferences/{$this->conference->id}/certificates", ['kinds' => ['attendance']])->assertForbidden();
    $this->actingAs($desk, 'sanctum')->getJson('/api/v1/admin/abstracts')->assertForbidden();
});

test('chairs manage the committee; a track chair needs a track of this conference, and is emailed', function () {
    $person = User::factory()->create(['status' => 'active', 'email' => 'tsion@example.com']);
    $url = "/api/v1/admin/conferences/{$this->conference->id}/committee";

    $this->actingAs($this->admin, 'sanctum')->postJson($url, ['user_id' => $person->id, 'role' => 'track_chair'])->assertJsonValidationErrors('track_id');
    $foreignTrack = ConferenceTrack::create(['conference_id' => $this->other->id, 'name' => 'X']);
    $this->actingAs($this->admin, 'sanctum')->postJson($url, ['user_id' => $person->id, 'role' => 'track_chair', 'track_id' => $foreignTrack->id])->assertJsonValidationErrors('track_id');
    $this->actingAs($this->admin, 'sanctum')->postJson($url, ['user_id' => $person->id, 'role' => 'track_chair', 'track_id' => $this->health->id])->assertCreated();
    $this->actingAs($this->admin, 'sanctum')->postJson($url, ['user_id' => $person->id, 'role' => 'track_chair', 'track_id' => $this->health->id])->assertUnprocessable();

    Queue::assertPushed(SendRawMailJob::class, fn ($job) => $job->to === 'tsion@example.com' && str_contains($job->subject, 'committee'));
    $this->actingAs($person, 'sanctum')->getJson('/api/v1/auth/me')->assertOk()
        ->assertJsonPath('data.user.conference_roles.0.role', 'track_chair');
});

test('the history lists what happened to the conference and its abstracts, leaving out super admins', function () {
    $abstract = cw_abstract($this->conference, ['title' => 'Malaria']);
    $chair = cw_member($this, 'chair');

    $this->actingAs($chair, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$abstract->id}/status", ['status' => 'rejected'])->assertOk();
    $this->actingAs($this->admin, 'sanctum')->patchJson("/api/v1/admin/abstracts/{$abstract->id}/status", ['status' => 'under_review'])->assertOk();

    $rows = $this->actingAs($chair, 'sanctum')->getJson("/api/v1/admin/conferences/{$this->conference->id}/history")->assertOk()->json('data.data');
    expect($rows)->toHaveCount(1)
        ->and($rows[0])->toMatchArray(['label' => 'Decision recorded', 'actor' => $chair->name, 'subject' => 'Malaria', 'change' => 'under review → rejected']);
});

test('copying a conference keeps its set-up and committee but none of its submissions or attendees', function () {
    $this->conference->update(['registration_questions' => [['id' => 'diet', 'label' => 'Diet', 'type' => 'text', 'required' => false]]]);
    $this->conference->reviewCriteria()->create(['name' => 'Originality', 'weight' => 3]);
    $this->conference->registrationTypes()->create(['name' => 'Student', 'capacity' => 40]);
    $speaker = $this->conference->speakers()->create(['name' => 'Prof. Alemu']);
    $session = $this->conference->sessions()->create(['title' => 'Opening', 'type' => 'keynote', 'starts_at' => now()->addMonth(), 'chair' => 'Dr. Bekele']);
    $session->speakers()->attach($speaker->id);
    cw_member($this, 'track_chair', $this->health->id);
    cw_abstract($this->conference);
    ConferenceRegistration::create(['conference_id' => $this->conference->id, 'name' => 'A', 'email' => 'a@example.com', 'status' => 'confirmed', 'registered_at' => now()]);

    $res = $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/conferences/{$this->conference->id}/duplicate", ['shift_years' => 1])->assertCreated();
    $copy = Conference::with(['tracks', 'reviewCriteria', 'registrationTypes', 'sessions.speakers', 'committee.track'])->find($res->json('data.id'));

    expect($copy->status)->toBe('draft')
        ->and($copy->slug)->not->toBe($this->conference->slug)
        ->and($copy->start_date->year)->toBe($this->conference->start_date->year + 1)
        ->and($copy->tracks->pluck('name')->sort()->values()->all())->toBe(['Farming', 'Health'])
        ->and($copy->reviewCriteria->first()->weight)->toBe(3)
        ->and($copy->registrationTypes->first()->capacity)->toBe(40)
        ->and($copy->registration_questions[0]['label'])->toBe('Diet')
        ->and($copy->sessions->first()->speakers->first()->name)->toBe('Prof. Alemu')
        ->and($copy->sessions->first()->speakers->first()->conference_id)->toBe($copy->id)
        // The track chair now chairs the copy's own Health track.
        ->and($copy->committee->first()->track->conference_id)->toBe($copy->id)
        ->and($copy->abstracts()->count())->toBe(0)
        ->and($copy->registrations()->count())->toBe(0);
});

test('the book of abstracts is a PDF of accepted abstracts, public only once published', function () {
    cw_abstract($this->conference, ['status' => 'accepted', 'track_id' => $this->health->id, 'keywords' => ['malaria']]);

    $this->actingAs($this->admin, 'sanctum')->get("/api/v1/admin/conferences/{$this->conference->id}/book-of-abstracts")
        ->assertOk()->assertHeader('content-type', 'application/pdf');
    $this->get('/api/v1/conferences/research-week/book-of-abstracts.pdf')->assertNotFound();

    $this->conference->update(['book_published' => true]);
    $this->get('/api/v1/conferences/research-week/book-of-abstracts.pdf')->assertOk()->assertHeader('content-type', 'application/pdf');
});
