<?php

use App\Models\AiInsight;
use App\Models\College;
use App\Models\Department;
use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\ReviewScore;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function ai_reply(array $json): void
{
    Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => json_encode($json)]]]])]);
}

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    config(['services.groq.api_key' => 'test-key', 'services.anthropic.api_key' => '', 'services.gemini.api_key' => '', 'services.ai_scoring.provider' => 'groq']);
    $this->pi = User::factory()->create();
    $this->pi->assignRole('staff');
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $college = College::factory()->create();
    $dept = Department::factory()->create(['college_id' => $college->id]);
    $call = ProposalCall::create(['academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'ai-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id]);
    $this->proposal = Proposal::create(['tracker_number' => 'DRAFT-'.rand(10000, 99999), 'proposal_call_id' => $call->id, 'pi_user_id' => $this->pi->id,
        'college_id' => $college->id, 'department_id' => $dept->id, 'title' => 'Soil Study', 'abstract' => 'We study soil.', 'status' => 'draft',
        'category' => 'research', 'academic_year' => '2026', 'created_by' => $this->pi->id]);
    $blind = EvaluationType::create(['name' => 'blind_review_ai', 'label' => 'Blind', 'proposal_category' => 'research', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $blind->id, 'name' => 'Relevance', 'order_index' => 1, 'weight' => 100]);
    $this->question = EvaluationQuestion::create(['evaluation_category_id' => $category->id, 'question_text' => 'Clear objectives', 'max_score' => 10, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);
    $this->blind = $blind;
});

test('the research team gets private feedback against the call criteria', function () {
    ai_reply(['readiness' => 'almost', 'overall' => 'Good start.', 'criteria' => [['criterion' => 'Clear objectives', 'assessment' => 'Partly', 'suggestion' => 'State measurable objectives.']],
        'budget' => 'Fine.', 'missing' => ['Work plan'], 'strengths' => ['Relevant topic'], 'extra' => 'ignored']);

    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/ai-coach")
        ->assertOk()
        ->assertJsonPath('data.result.readiness', 'almost')
        ->assertJsonPath('data.result.criteria.0.suggestion', 'State measurable objectives.')
        ->assertJsonMissingPath('data.result.extra');

    Http::assertSent(fn ($request) => str_contains($request['messages'][1]['content'], 'Clear objectives (max 10)'));
});

test('only the team can use the coach, and only before submission', function () {
    ai_reply(['overall' => 'x']);
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/ai-coach")->assertForbidden();

    $this->proposal->update(['status' => 'submitted']);
    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/ai-coach")->assertStatus(422);
});

test('the coach is limited per day and can be switched off', function () {
    ai_reply(['overall' => 'x']);
    foreach (range(1, 5) as $i) {
        AiInsight::create(['proposal_id' => $this->proposal->id, 'type' => AiInsight::TYPE_COACH, 'result' => ['overall' => 'x']]);
    }
    $this->actingAs($this->pi, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/ai-coach")
        ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'try again tomorrow'));

    DB::table('app_settings')->insert(['id' => (string) Str::uuid(), 'key' => 'ai_coach_enabled', 'value' => 'false', 'type' => 'boolean', 'group' => 'general']);
    $this->actingAs($this->pi, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/ai-coach")->assertJsonPath('data.enabled', false);
});

test('the review summary only keeps points traced to real reviewers, and counts recommendations itself', function () {
    $this->proposal->update(['status' => 'accepted']);
    foreach (['fund', 'fund'] as $rec) {
        $a = ReviewAssignment::create(['proposal_id' => $this->proposal->id, 'reviewer_id' => User::factory()->create()->id, 'evaluation_type_id' => $this->blind->id,
            'assigned_by' => $this->central->id, 'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now()]);
        ReviewScore::create(['review_assignment_id' => $a->id, 'evaluation_question_id' => $this->question->id, 'score' => 8, 'comment' => 'Solid plan', 'recommendation' => $rec]);
    }
    ai_reply(['summary' => 'Reviewers liked it.',
        'strengths' => [['point' => 'Solid plan', 'sources' => ['Blind reviewer 1', 'Blind reviewer 2']], ['point' => 'Made up', 'sources' => ['Blind reviewer 9']]],
        'concerns' => [], 'disagreements' => []]);

    $data = $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/ai-review-summary")->assertOk()->json('data.result');

    expect(collect($data['strengths'])->pluck('point')->all())->toBe(['Solid plan'])
        ->and($data['recommendations'])->toBe(['fund' => 2]);
    Http::assertSent(fn ($request) => ! str_contains($request['messages'][1]['content'], User::first()->name));

    $this->actingAs($this->pi, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/ai-review-summary")->assertForbidden();
});

test('a summary is flagged as out of date when another review arrives', function () {
    $this->proposal->update(['status' => 'accepted']);
    $make = fn () => ReviewAssignment::create(['proposal_id' => $this->proposal->id, 'reviewer_id' => User::factory()->create()->id, 'evaluation_type_id' => $this->blind->id,
        'assigned_by' => $this->central->id, 'status' => 'submitted', 'assigned_at' => now(), 'submitted_at' => now()]);
    $make();
    ai_reply(['summary' => 'One review.', 'strengths' => [], 'concerns' => [], 'disagreements' => []]);
    $this->actingAs($this->central, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/ai-review-summary")->assertOk();

    $make();

    $this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/ai-review-summary")
        ->assertJsonPath('data.stale', true)->assertJsonPath('data.reviews', 2);
});
