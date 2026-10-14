<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalAiScore;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\ProposalAiScoringService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

function aiscore_makeProposal(): Proposal
{
    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $admin = User::factory()->create();
    $admin->assignRole('central_officer');

    $college = College::create(['name' => 'AI College '.rand(), 'code' => 'AI'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'AID'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'AI Call', 'slug' => 'ai-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'AI-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'AI Proposal', 'status' => 'submitted',
        'pi_user_id' => $pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);
}

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    config(['services.anthropic.api_key' => 'test-anthropic-key', 'services.gemini.api_key' => '', 'services.groq.api_key' => '']);
});

test('a successful provider response is stored and clears any previous error_message', function () {
    Http::fake([
        'api.anthropic.com/*' => Http::response([
            'content' => [['text' => json_encode(['overall_score' => 8, 'clarity_score' => 7, 'summary' => 'Solid proposal.'])]],
        ], 200),
    ]);

    $proposal = aiscore_makeProposal();
    ProposalAiScore::create(['proposal_id' => $proposal->id, 'status' => 'failed', 'error_message' => 'stale error']);

    $score = app(ProposalAiScoringService::class)->score($proposal);

    expect($score->status)->toBe('completed')
        ->and($score->overall_score)->toBe(8)
        ->and($score->error_message)->toBeNull();
});

test('a non-successful HTTP response is persisted as a failed score with the provider error text', function () {
    Http::fake([
        'api.anthropic.com/*' => Http::response(['error' => ['message' => 'invalid x-api-key']], 401),
    ]);

    $proposal = aiscore_makeProposal();

    $score = app(ProposalAiScoringService::class)->score($proposal);

    expect($score->status)->toBe('failed')
        ->and($score->error_message)->toContain('401')
        ->and($score->error_message)->toContain('invalid x-api-key');
});

test('a connection failure (e.g. outbound HTTPS blocked) is reported with a network-specific message', function () {
    Http::fake(function () {
        throw new ConnectionException('cURL error 7: Failed to connect to api.anthropic.com');
    });

    $proposal = aiscore_makeProposal();

    $score = app(ProposalAiScoringService::class)->score($proposal);

    expect($score->status)->toBe('failed')
        ->and($score->error_message)->toContain('Could not reach the AI provider');
});

test('a response missing the expected scorecard JSON is treated as a failure, not a silent blank score', function () {
    Http::fake([
        'api.anthropic.com/*' => Http::response([
            'content' => [['text' => 'Sorry, I cannot help with that.']],
        ], 200),
    ]);

    $proposal = aiscore_makeProposal();

    $score = app(ProposalAiScoringService::class)->score($proposal);

    expect($score->status)->toBe('failed')
        ->and($score->overall_score)->toBeNull();
});

test('the AI score endpoint surfaces the specific error_message instead of a generic one', function () {
    Http::fake([
        'api.anthropic.com/*' => Http::response(['error' => ['message' => 'invalid x-api-key']], 401),
    ]);

    $admin = User::factory()->create();
    $admin->assignRole('central_officer');
    $proposal = aiscore_makeProposal();

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/proposals/{$proposal->id}/ai-score/generate");

    $response->assertStatus(500);
    expect($response->json('message'))->toContain('invalid x-api-key');
});
