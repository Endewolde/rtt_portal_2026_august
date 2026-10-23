<?php

use App\Models\Award;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\Publication;
use App\Models\ResearchOutput;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\DoiLookupService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Queue::fake();
    Cache::flush();

    $this->college = College::create(['name' => 'DL '.rand(), 'code' => 'DL'.rand(10000, 99999)]);
    $plan = SubscriptionPlan::firstOrCreate(
        ['slug' => 'professional'],
        ['name' => 'Professional', 'description' => 'Pro', 'features' => ['proposals', 'finance', 'evaluation', 'monitoring', 'complaints', 'repository'], 'price' => 0, 'billing_period' => 'annual', 'is_active' => true]
    );
    Subscription::factory()->create(['college_id' => $this->college->id, 'subscription_plan_id' => $plan->id]);
    $this->dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'DLD'.rand(10000, 99999)]);

    $this->pi = User::factory()->create(['college_id' => $this->college->id]);
    $this->pi->assignRole('staff');
    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'dl-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->pi->id,
    ]);

    $this->water = dl_project($this, 'Groundwater quality and sanitation in rural Wolaita', 'midterm_evaluation');
    $this->crops = dl_project($this, 'Improving sorghum yield with drought tolerant varieties');
});

function dl_project(object $ctx, string $title, string $status = 'funded'): Proposal
{
    return Proposal::create([
        'tracker_number' => 'DL-'.rand(100000, 999999), 'proposal_call_id' => $ctx->call->id, 'category' => 'research',
        'title' => $title, 'status' => $status, 'pi_user_id' => $ctx->pi->id, 'college_id' => $ctx->college->id,
        'department_id' => $ctx->dept->id, 'academic_year' => '2026', 'created_by' => $ctx->pi->id,
    ]);
}

function dl_crossref(array $overrides = []): void
{
    Http::fake(['api.crossref.org/*' => Http::response(['status' => 'ok', 'message' => array_merge([
        'type' => 'journal-article',
        'title' => ['Nitrate contamination of groundwater in rural Wolaita'],
        'abstract' => '<jats:title>Abstract</jats:title><jats:p>We sampled 120 wells.</jats:p>',
        'container-title' => ['Journal of Water and Health'],
        'publisher' => 'IWA Publishing',
        'volume' => '22', 'issue' => '4', 'page' => '512-530',
        'published-print' => ['date-parts' => [[2025, 4]]],
        'author' => [['given' => 'Abebe', 'family' => 'Kebede'], ['given' => 'Sara', 'family' => 'Tadesse']],
        'URL' => 'https://doi.org/10.2166/wh.2025.101',
    ], $overrides)])]);
}

test('a DOI fills in the publication details', function () {
    dl_crossref();

    $data = $this->actingAs($this->pi, 'sanctum')
        ->getJson('/api/v1/research-outputs/doi-lookup?doi='.urlencode('https://doi.org/10.2166/WH.2025.101'))
        ->assertOk()
        ->json('data');

    expect($data['doi'])->toBe('10.2166/wh.2025.101')
        ->and($data['fields'])->toMatchArray([
            'output_type' => 'journal_article',
            'title' => 'Nitrate contamination of groundwater in rural Wolaita',
            'description' => 'We sampled 120 wells.',
            'journal_name' => 'Journal of Water and Health',
            'volume' => '22', 'issue' => '4', 'pages' => '512-530', 'year' => 2025,
        ])
        ->and($data['authors'])->toBe(['Abebe Kebede', 'Sara Tadesse']);
});

test('the project is suggested from the closest title among the researcher\'s funded projects', function () {
    dl_crossref();

    $suggestion = $this->actingAs($this->pi, 'sanctum')
        ->getJson('/api/v1/research-outputs/doi-lookup?doi=10.2166/wh.2025.101')
        ->assertOk()
        ->json('data.suggestion');

    expect($suggestion['proposal_id'])->toBe($this->water->id);
});

test('a grant reference acknowledged in the paper links it to that project', function () {
    Award::create(['proposal_id' => $this->crops->id, 'grant_reference' => 'WSU-RTT-2025-077', 'awarded_amount' => 1000, 'approved_by' => $this->pi->id, 'approved_at' => now()]);
    dl_crossref(['funder' => [['name' => 'Wolaita Sodo University', 'award' => ['wsu-rtt-2025-077']]]]);

    $suggestion = $this->actingAs($this->pi, 'sanctum')
        ->getJson('/api/v1/research-outputs/doi-lookup?doi=10.2166/wh.2025.101')
        ->json('data.suggestion');

    expect($suggestion['proposal_id'])->toBe($this->crops->id)
        ->and($suggestion['reason'])->toContain('WSU-RTT-2025-077');
});

test('an unknown DOI and a malformed one are explained', function () {
    Http::fake(['api.crossref.org/*' => Http::response(['status' => 'error'], 404)]);

    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/research-outputs/doi-lookup?doi=10.9999/missing')
        ->assertUnprocessable()->assertJsonPath('message', 'No publication was found with this DOI. Check it, or enter the details by hand.');
    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/research-outputs/doi-lookup?doi=not-a-doi')
        ->assertUnprocessable();
});

test('a DOI already recorded is flagged by the lookup and refused when saved again', function () {
    dl_crossref();
    $first = $this->actingAs($this->pi, 'sanctum')->postJson('/api/v1/research-outputs', [
        'proposal_id' => $this->water->id, 'output_type' => 'journal_article', 'title' => 'Nitrate paper', 'doi' => 'doi:10.2166/WH.2025.101',
    ])->assertCreated();

    expect(Publication::where('research_output_id', $first->json('data.id'))->value('doi'))->toBe('10.2166/wh.2025.101');

    $this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/research-outputs/doi-lookup?doi=10.2166/wh.2025.101')
        ->assertJsonPath('data.existing.title', 'Nitrate paper');

    $this->actingAs($this->pi, 'sanctum')->postJson('/api/v1/research-outputs', [
        'proposal_id' => $this->crops->id, 'output_type' => 'journal_article', 'title' => 'Same paper', 'doi' => '10.2166/wh.2025.101',
    ])->assertUnprocessable()->assertJsonValidationErrors('doi');
});

test('a project at mid-term evaluation can have outputs recorded', function () {
    $ids = collect($this->actingAs($this->pi, 'sanctum')->getJson('/api/v1/research-outputs/eligible-proposals')->json('data'))->pluck('id');

    expect($ids)->toContain($this->water->id, $this->crops->id);
});

test('a book keeps its publication details, and editing an output saves its details', function () {
    $id = $this->actingAs($this->pi, 'sanctum')->postJson('/api/v1/research-outputs', [
        'proposal_id' => $this->crops->id, 'output_type' => 'book', 'title' => 'Sorghum handbook',
        'publisher' => 'WSU Press', 'year' => 2025,
    ])->assertCreated()->json('data.id');

    expect(Publication::where('research_output_id', $id)->value('publisher'))->toBe('WSU Press');

    $this->actingAs($this->pi, 'sanctum')->putJson("/api/v1/research-outputs/{$id}", ['publisher' => 'Wolaita Sodo University Press', 'doi' => '10.5555/sorghum.2025'])
        ->assertOk();

    $publication = ResearchOutput::find($id)->publication;
    expect($publication->publisher)->toBe('Wolaita Sodo University Press')
        ->and($publication->doi)->toBe('10.5555/sorghum.2025');
});

test('DOIs are normalised from links and prefixes', function () {
    expect(DoiLookupService::normalize('https://dx.doi.org/10.1000/ABC'))->toBe('10.1000/abc')
        ->and(DoiLookupService::normalize(' doi: 10.1000/xyz '))->toBe('10.1000/xyz')
        ->and(DoiLookupService::normalize('hello'))->toBeNull();
});
