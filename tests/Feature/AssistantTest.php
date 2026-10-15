<?php

use App\Models\AssistantQuery;
use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationType;
use App\Models\HelpArticle;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Database\Seeders\HelpArticleSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new HelpArticleSeeder)->run();
    $this->pi = User::factory()->create();
    $this->pi->assignRole('staff');
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $call = ProposalCall::create(['academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'as-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->pi->id]);
    $this->proposal = Proposal::create(['tracker_number' => 'RES-2026-000321', 'proposal_call_id' => $call->id, 'pi_user_id' => $this->pi->id,
        'college_id' => $college->id, 'department_id' => $dept->id, 'title' => 'Soil Study', 'status' => 'under_blind_review',
        'category' => 'research', 'academic_year' => '2026', 'created_by' => $this->pi->id]);
    $this->ask = fn (User $u, string $q) => $this->actingAs($u, 'sanctum')->postJson('/api/v1/assistant/ask', ['q' => $q, 'page' => '/dashboard'])->assertOk()->json('data');
});

test('a how-to question is answered from the matching article, even with a typo', function () {
    $answer = ($this->ask)($this->pi, 'how do i submitt a proposal');

    expect($answer['type'])->toBe('article')
        ->and($answer['articles'][0]['slug'])->toBe('submit-proposal')
        ->and(AssistantQuery::first()->help_article_id)->toBe(HelpArticle::where('slug', 'submit-proposal')->value('id'));
});

test('people only get articles meant for their role', function () {
    $answer = ($this->ask)($this->pi, 'how do I release reviewer certificates for the year');

    expect(collect($answer['articles'])->pluck('slug'))->not->toContain('release-certificates');
});

test('"where is my proposal" answers from the person\'s own proposals', function () {
    $answer = ($this->ask)($this->pi, 'Where is my proposal?');

    expect($answer['intent'])->toBe('my_proposals')
        ->and($answer['cards'][0]['subtitle'])->toBe('RES-2026-000321')
        ->and($answer['cards'][0]['lines'][0])->toContain('Stage:');
});

test('a tracker number is only looked up for people who may see it', function () {
    expect(($this->ask)($this->pi, 'RES-2026-000321')['cards'])->toHaveCount(1);

    $stranger = User::factory()->create();
    $stranger->assignRole('staff');
    expect(($this->ask)($stranger, 'status of RES-2026-000321')['cards'])->toBe([]);
});

test('reviewers see the reviews they still have to do', function () {
    $reviewer = User::factory()->create();
    $reviewer->assignRole('staff');
    $type = EvaluationType::create(['name' => 'blind_review_as', 'label' => 'B', 'proposal_category' => 'research', 'is_active' => true]);
    ReviewAssignment::create(['proposal_id' => $this->proposal->id, 'reviewer_id' => $reviewer->id, 'evaluation_type_id' => $type->id,
        'assigned_by' => $this->pi->id, 'status' => 'pending', 'assigned_at' => now(), 'due_date' => now()->addDays(3)->toDateString()]);

    $answer = ($this->ask)($reviewer, 'which reviews are due?');

    expect($answer['intent'])->toBe('my_reviews')
        ->and($answer['cards'])->toHaveCount(1)
        ->and($answer['cards'][0]['subtitle'])->toContain('Blind review');
});

test('an unanswerable question says so, is logged, and feedback is recorded', function () {
    $answer = ($this->ask)($this->pi, 'what is the weather in sodo');

    expect($answer['type'])->toBe('none');

    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/assistant/queries/{$answer['query_id']}/feedback", ['helpful' => false])->assertOk();
    expect(AssistantQuery::find($answer['query_id'])->helpful)->toBeFalse();
});

test('only admins can edit articles; everyone reads the help centre', function () {
    $this->actingAs($this->pi, 'sanctum')->postJson('/api/v1/admin/help-articles', ['title' => 'X'])->assertForbidden();
    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/help/articles/submit-proposal')->assertOk()->assertJsonPath('data.title', 'Submitting a research proposal');

    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/help-articles', [
        'title' => 'Booking the hall', 'summary' => 'How to book.', 'body' => 'Call the office.', 'category' => 'Other', 'roles' => [], 'is_published' => true,
    ])->assertOk()->assertJsonPath('data.slug', 'booking-the-hall');
});

test('help:evaluate reports how well the articles answer their own questions', function () {
    $this->artisan('help:evaluate')->expectsOutputToContain('questions · first result')->assertSuccessful();
});

test('a question asked the way an article lists it finds that article first', function () {
    $wordy = HelpArticle::create(['slug' => 'zz-wordy', 'title' => 'Quarry permits and quarry fees', 'category' => 'Test', 'is_published' => true,
        'summary' => 'Quarry permits.', 'keywords' => 'quarry permit quarry fee', 'body' => str_repeat('Quarry permit fee. ', 20)]);
    $listed = HelpArticle::create(['slug' => 'zz-listed', 'title' => 'Site access', 'category' => 'Test', 'is_published' => true,
        'summary' => 'Getting onto a site.', 'keywords' => 'site access', 'body' => 'Ask the site office.', 'questions' => 'Do I need a quarry permit to visit?']);

    expect(($this->ask)($this->pi, 'do i need a quarry permit to visit')['articles'][0]['slug'])->toBe('zz-listed')
        ->and(($this->ask)($this->pi, 'quarry permit fee')['articles'][0]['slug'])->toBe('zz-wordy');
});
