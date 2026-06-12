<?php

use App\Models\College;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\SimilarityService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ThresholdSettingSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    (new ThresholdSettingSeeder)->run();
    Queue::fake();

    $this->college = College::create(['name' => 'Sim College', 'code' => 'SM'.rand(10, 99)]);
    $this->dept    = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'SD'.rand(10, 99)]);

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    NotificationPreference::create([
        'user_id'          => $this->central->id,
        'email_enabled'    => true,
        'telegram_enabled' => false,
        'inapp_enabled'    => true,
    ]);

    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'sim-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sim_proposal(College $college, Department $dept, ProposalCall $call, array $attrs = []): Proposal
{
    $pi = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]);
    $pi->assignRole('pi');

    return Proposal::create(array_merge([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category'         => 'research',
        'title'            => 'Default Title',
        'abstract'         => 'Default abstract content for testing.',
        'keywords'         => 'default test',
        'status'           => 'submitted',
        'pi_user_id'       => $pi->id,
        'college_id'       => $college->id,
        'department_id'    => $dept->id,
        'academic_year'    => '2026',
        'created_by'       => $pi->id,
    ], $attrs));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('identical text produces score of 1.0', function () {
    $sharedText = 'machine learning artificial intelligence deep neural network optimization algorithm';

    $p1 = sim_proposal($this->college, $this->dept, $this->call, [
        'title' => $sharedText, 'abstract' => $sharedText, 'keywords' => 'machine learning',
    ]);
    sim_proposal($this->college, $this->dept, $this->call, [
        'title' => $sharedText, 'abstract' => $sharedText, 'keywords' => 'machine learning',
    ]);

    app(SimilarityService::class)->check($p1);

    $score = DB::table('similarity_scores')
        ->where('proposal_id', $p1->id)
        ->orderByDesc('score')
        ->value('score');

    expect((float) $score)->toBeGreaterThan(0.99);
});

test('completely different text produces score close to 0', function () {
    $p1 = sim_proposal($this->college, $this->dept, $this->call, [
        'title'    => 'quantum physics nuclear spectroscopy uranium isotopes reactor',
        'abstract' => 'This research investigates nuclear reactor fuel cycle isotope separation',
        'keywords' => 'nuclear physics reactor',
    ]);
    sim_proposal($this->college, $this->dept, $this->call, [
        'title'    => 'anthropological ethnographic study highland pastoral communities herders',
        'abstract' => 'Ethnographic fieldwork examining traditional pastoral societies nomadic herders',
        'keywords' => 'ethnography anthropology pastoral',
    ]);

    app(SimilarityService::class)->check($p1);

    $score = DB::table('similarity_scores')
        ->where('proposal_id', $p1->id)
        ->orderByDesc('score')
        ->value('score');

    expect((float) $score)->toBeLessThan(0.2);
});

test('top 5 scores stored in similarity_scores table', function () {
    $main = sim_proposal($this->college, $this->dept, $this->call, [
        'title' => 'research methodology data analysis empirical study field investigation',
    ]);

    for ($i = 1; $i <= 7; $i++) {
        sim_proposal($this->college, $this->dept, $this->call, [
            'title' => "Similar proposal {$i} research methodology analysis empirical data",
        ]);
    }

    app(SimilarityService::class)->check($main);

    $count = DB::table('similarity_scores')->where('proposal_id', $main->id)->count();

    expect($count)->toBeLessThanOrEqual(5);
});

test('proposals above threshold have flagged = true', function () {
    $text = 'innovative sustainable agricultural water irrigation management rural Ethiopia crops harvest';

    $p1 = sim_proposal($this->college, $this->dept, $this->call, [
        'title' => $text, 'abstract' => $text.' '.$text, 'keywords' => 'agriculture irrigation',
    ]);
    sim_proposal($this->college, $this->dept, $this->call, [
        'title' => $text, 'abstract' => $text.' '.$text, 'keywords' => 'agriculture irrigation',
    ]);

    DB::table('threshold_settings')->where('key', 'similarity_threshold')->update(['value' => 0.01]);

    app(SimilarityService::class)->check($p1);

    $flagged = DB::table('similarity_scores')
        ->where('proposal_id', $p1->id)
        ->where('flagged', true)
        ->count();

    expect($flagged)->toBeGreaterThan(0);
});

test('proposals below threshold have flagged = false', function () {
    $p1 = sim_proposal($this->college, $this->dept, $this->call, [
        'title'    => 'cellular biology protein folding biochemical pathways metabolism enzyme',
        'abstract' => 'Investigation of enzyme catalysis in metabolic pathways using spectroscopy',
        'keywords' => 'biochemistry protein enzyme',
    ]);
    sim_proposal($this->college, $this->dept, $this->call, [
        'title'    => 'sociolinguistic patterns urban youth language shift code switching identity',
        'abstract' => 'Analysis of language behavior among urban adolescents in multilingual contexts',
        'keywords' => 'linguistics language youth',
    ]);

    DB::table('threshold_settings')->where('key', 'similarity_threshold')->update(['value' => 0.99]);

    app(SimilarityService::class)->check($p1);

    $flagged = DB::table('similarity_scores')
        ->where('proposal_id', $p1->id)
        ->where('flagged', true)
        ->count();

    expect($flagged)->toBe(0);
});

test('check() does NOT modify proposal status', function () {
    $p1 = sim_proposal($this->college, $this->dept, $this->call, ['status' => 'submitted']);
    sim_proposal($this->college, $this->dept, $this->call, ['title' => 'Another proposal similar text submitted research']);

    app(SimilarityService::class)->check($p1);

    expect($p1->fresh()->status)->toBe('submitted');
});

test('similarity_flagged notification dispatched for flagged proposals', function () {
    $text = 'groundwater contamination heavy metals toxicology remediation environmental Ethiopia analysis';

    $p1 = sim_proposal($this->college, $this->dept, $this->call, [
        'title' => $text, 'abstract' => $text, 'keywords' => 'water environment',
    ]);
    sim_proposal($this->college, $this->dept, $this->call, [
        'title' => $text, 'abstract' => $text, 'keywords' => 'water environment',
    ]);

    DB::table('threshold_settings')->where('key', 'similarity_threshold')->update(['value' => 0.01]);

    app(SimilarityService::class)->check($p1);

    Queue::assertPushed(\App\Jobs\StoreInAppNotificationJob::class, function ($job) {
        return $job->event === 'similarity_flagged';
    });
});

test('check() does nothing if no other proposals in same category', function () {
    $p1 = sim_proposal($this->college, $this->dept, $this->call, [
        'status' => 'submitted', 'category' => 'innovation',
    ]);

    app(SimilarityService::class)->check($p1);

    $count = DB::table('similarity_scores')->where('proposal_id', $p1->id)->count();

    expect($count)->toBe(0);
});
