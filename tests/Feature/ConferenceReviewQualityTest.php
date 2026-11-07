<?php

use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\ConferenceAbstractReview;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->admin = User::factory()->create();
    $this->admin->assignRole('super_admin');
    $this->conference = Conference::create([
        'title' => 'Research Week', 'start_date' => now()->addMonth(), 'end_date' => now()->addMonth()->addDay(),
        'status' => 'published', 'created_by' => $this->admin->id, 'abstract_submission_open' => true, 'location_type' => 'physical',
        'abstract_min_words' => 5, // the sample abstracts here are short
    ]);
});

function crq_setup(object $ctx, array $setup): void
{
    $ctx->actingAs($ctx->admin, 'sanctum')->putJson("/api/v1/admin/conferences/{$ctx->conference->id}", $setup)->assertOk();
    $ctx->conference->refresh();
}

function crq_abstract(object $ctx, array $overrides = []): ConferenceAbstract
{
    return ConferenceAbstract::create([
        'conference_id' => $ctx->conference->id, 'submitter_name' => 'Almaz Bekele', 'submitter_email' => 'almaz@wsu.edu.et',
        'submitter_affiliation' => 'Wolaita Sodo University', 'title' => 'Soil health in Wolaita', 'body' => str_repeat('Soil study. ', 10),
        'presentation_type' => 'oral', 'status' => 'submitted', 'submitted_at' => now(),
        'co_authors' => [['name' => 'Dawit Hailu', 'email' => 'dawit@aau.edu.et', 'affiliation' => 'Addis Ababa University', 'presenting' => false]],
        ...$overrides,
    ]);
}

function crq_reviewer(array $attrs = []): User
{
    $reviewer = User::factory()->create(['status' => 'active', ...$attrs]);
    $reviewer->assignRole('reviewer');

    return $reviewer;
}

test('a conference keeps its tracks and rubric as edited, and abstracts on a removed track keep no track', function () {
    crq_setup($this, [
        'review_mode' => 'double_blind',
        'tracks' => [['name' => 'Agriculture'], ['name' => 'Health']],
        'review_criteria' => [['name' => 'Originality', 'weight' => 2], ['name' => 'Clarity', 'weight' => 1]],
    ]);
    $tracks = $this->conference->tracks;
    $abstract = crq_abstract($this, ['track_id' => $tracks->firstWhere('name', 'Health')->id]);

    crq_setup($this, ['tracks' => [['id' => $tracks->firstWhere('name', 'Agriculture')->id, 'name' => 'Agriculture & Food']]]);

    expect($this->conference->tracks->pluck('name')->all())->toBe(['Agriculture & Food'])
        ->and($this->conference->reviewCriteria->pluck('weight', 'name')->all())->toBe(['Originality' => 2, 'Clarity' => 1])
        ->and($abstract->fresh()->track_id)->toBeNull();
});

test('submitting to a conference with tracks needs a track, and authors are recorded with ORCID and who presents', function () {
    crq_setup($this, ['tracks' => [['name' => 'Agriculture']]]);
    $payload = [
        'submitter_name' => 'Almaz Bekele', 'submitter_email' => 'Almaz@wsu.edu.et', 'submitter_affiliation' => 'Wolaita Sodo University',
        'submitter_orcid' => '0000-0002-1825-009X', 'submitter_country' => 'Ethiopia',
        'co_authors' => [['name' => 'Dawit Hailu', 'email' => 'dawit@aau.edu.et', 'affiliation' => 'AAU', 'country' => 'Ethiopia', 'presenting' => true]],
        'title' => 'Soil health', 'body' => str_repeat('Soil study text. ', 6), 'presentation_type' => 'oral', 'action' => 'submit',
    ];

    $this->postJson("/api/v1/conferences/{$this->conference->slug}/abstracts", $payload)->assertUnprocessable()->assertJsonValidationErrors('track_id');
    $this->postJson("/api/v1/conferences/{$this->conference->slug}/abstracts", [...$payload, 'track_id' => $this->conference->tracks->first()->id, 'submitter_orcid' => '1234'])
        ->assertUnprocessable()->assertJsonValidationErrors('submitter_orcid');

    $this->postJson("/api/v1/conferences/{$this->conference->slug}/abstracts", [...$payload, 'track_id' => $this->conference->tracks->first()->id])->assertCreated();

    $abstract = ConferenceAbstract::firstOrFail();
    expect($abstract->track_id)->toBe($this->conference->tracks->first()->id)
        ->and($abstract->submitter_orcid)->toBe('0000-0002-1825-009X')
        ->and($abstract->submitter_presenting)->toBeFalse() // the co-author presents
        ->and(collect($abstract->authors())->where('presenting', true)->pluck('name')->all())->toBe(['Dawit Hailu']);
});

test('in double-blind review the reviewer never receives who wrote the abstract; in single-blind they do', function () {
    $abstract = crq_abstract($this);
    $reviewer = crq_reviewer();
    ConferenceAbstractReview::create(['abstract_id' => $abstract->id, 'reviewer_id' => $reviewer->id]);

    $blind = $this->actingAs($reviewer, 'sanctum')->getJson('/api/v1/reviewer/abstracts')->assertOk()->json('data.0');
    expect($blind['blind'])->toBeTrue()
        ->and($blind)->not->toHaveKeys(['submitter_name', 'submitter_email', 'submitter_affiliation', 'co_authors', 'file_path'])
        ->and(json_encode($blind))->not->toContain('Almaz')->not->toContain('Dawit');

    crq_setup($this, ['review_mode' => 'single_blind']);
    $open = $this->actingAs($reviewer, 'sanctum')->getJson('/api/v1/reviewer/abstracts')->assertOk()->json('data.0');
    expect($open['blind'])->toBeFalse()->and($open['submitter_name'])->toBe('Almaz Bekele');
});

test('a co-author cannot review, and a reviewer at an author\'s institution needs the committee to confirm', function () {
    $abstract = crq_abstract($this);

    $coAuthor = crq_reviewer(['email' => 'dawit@aau.edu.et']);
    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/abstracts/{$abstract->id}/assign-reviewer", ['reviewer_id' => $coAuthor->id])
        ->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, 'an author'));

    $colleague = crq_reviewer(['affiliation' => 'Addis Ababa University']);
    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/abstracts/{$abstract->id}/assign-reviewer", ['reviewer_id' => $colleague->id])
        ->assertUnprocessable()->assertJsonPath('meta.code', 'possible_conflict');
    $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/abstracts/{$abstract->id}/assign-reviewer", ['reviewer_id' => $colleague->id, 'acknowledge_conflict' => true])
        ->assertOk();
});

test('with a rubric every criterion is scored and the overall score is their weighted result', function () {
    crq_setup($this, ['review_criteria' => [['name' => 'Originality', 'weight' => 3], ['name' => 'Clarity', 'weight' => 1]]]);
    $abstract = crq_abstract($this, ['status' => 'under_review']);
    $reviewer = crq_reviewer();
    ConferenceAbstractReview::create(['abstract_id' => $abstract->id, 'reviewer_id' => $reviewer->id]);
    [$orig, $clar] = [$this->conference->reviewCriteria->firstWhere('name', 'Originality'), $this->conference->reviewCriteria->firstWhere('name', 'Clarity')];

    $this->actingAs($reviewer, 'sanctum')->postJson("/api/v1/reviewer/abstracts/{$abstract->id}/review", ['criteria_scores' => [$orig->id => 5], 'recommendation' => 'accept'])
        ->assertUnprocessable();

    $this->actingAs($reviewer, 'sanctum')->postJson("/api/v1/reviewer/abstracts/{$abstract->id}/review", [
        'criteria_scores' => [$orig->id => 5, $clar->id => 1], 'recommendation' => 'accept',
        'comments' => 'Clear and useful.', 'confidential_comments' => 'Strong, but check the sample size.',
    ])->assertOk();

    $review = ConferenceAbstractReview::firstOrFail();
    // (5×3 + 1×1) / 4 = 4 out of 5 → 8 out of 10
    expect($review->score)->toBe(8)
        ->and(collect($review->criteria_scores)->pluck('score', 'name')->all())->toBe(['Originality' => 5, 'Clarity' => 1])
        ->and($review->confidential_comments)->toBe('Strong, but check the sample size.');
});

test('a reviewer who declares a conflict cannot review, and the abstract is ready once the others have reported', function () {
    $abstract = crq_abstract($this, ['status' => 'under_review']);
    [$conflicted, $other] = [crq_reviewer(), crq_reviewer()];
    ConferenceAbstractReview::create(['abstract_id' => $abstract->id, 'reviewer_id' => $conflicted->id]);
    ConferenceAbstractReview::create(['abstract_id' => $abstract->id, 'reviewer_id' => $other->id, 'score' => 7, 'recommendation' => 'accept', 'submitted_at' => now()]);

    $this->actingAs($conflicted, 'sanctum')->postJson("/api/v1/reviewer/abstracts/{$abstract->id}/conflict", ['reason' => 'I supervised the first author.'])->assertOk();
    $this->actingAs($conflicted, 'sanctum')->postJson("/api/v1/reviewer/abstracts/{$abstract->id}/review", ['score' => 9, 'recommendation' => 'accept'])->assertUnprocessable();

    $list = $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/admin/abstracts?conference_id={$this->conference->id}")->json('data');
    expect($list['counts']['ready_for_decision'])->toBe(1)
        ->and($list['data'][0])->toMatchArray(['reviews_count' => 2, 'reviews_done_count' => 1, 'reviews_conflict_count' => 1])
        ->and($this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/admin/abstracts/{$abstract->id}")->json('data.conflicts'))->toBe(1);
});

test('an abstract is held to the conference\'s word limits when submitted, counting Amharic words too, but a draft may be short', function () {
    $this->conference->update(['abstract_min_words' => 5, 'abstract_max_words' => 8]);
    $base = ['submitter_name' => 'Hana', 'submitter_email' => 'hana@example.com', 'title' => 'T', 'presentation_type' => 'oral'];
    $post = fn (string $body, string $action) => $this->postJson("/api/v1/conferences/{$this->conference->slug}/abstracts", $base + ['body' => $body, 'action' => $action]);

    $post('Too short here', 'submit')->assertJsonValidationErrors(['body' => 'at least 5']);
    $post('one two three four five six seven eight nine', 'submit')->assertJsonValidationErrors(['body' => 'at most 8']);
    $post('Too short here', 'draft')->assertSuccessful();
    // Six Amharic words: PHP's own word count would make this zero.
    $post('የአፈር ለምነት በወላይታ ዞን ጥናት ውጤት', 'submit')->assertSuccessful();
    expect(ConferenceAbstract::where('body', 'የአፈር ለምነት በወላይታ ዞን ጥናት ውጤት')->value('word_count'))->toBe(6);
});
