<?php

use App\Models\Award;
use App\Models\BudgetRequest;
use App\Models\College;
use App\Models\Department;
use App\Models\Disbursement;
use App\Models\FormTemplate;
use App\Models\MidtermEvaluation;
use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->college = College::create(['name' => 'Risk College', 'code' => 'RK'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'RKD'.rand(10000, 99999)]);
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $this->call = ProposalCall::create([
        'academic_year' => '2025-2026', 'category' => 'research', 'title' => 'Risk Call', 'slug' => 'rk-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->template = FormTemplate::create(['name' => 'Budget Form', 'is_active' => true, 'created_by' => $this->central->id]);
});

/** A running project funded $daysAgo days ago, 12 months long, with an approved contract and a midterm. */
function rk_project(object $ctx, int $daysAgo, array $overrides = [], ?College $college = null): Proposal
{
    $college ??= $ctx->college;
    $pi = User::factory()->create();
    $proposal = Proposal::create($overrides + [
        'tracker_number' => 'RK-'.rand(100000, 999999), 'proposal_call_id' => $ctx->call->id, 'category' => 'research',
        'title' => 'Risk Project '.rand(), 'status' => 'midterm_evaluation', 'pi_user_id' => $pi->id, 'duration_months' => 12,
        'college_id' => $college->id, 'department_id' => $ctx->dept->id, 'academic_year' => '2025-2026',
        'contract_status' => 'approved', 'created_by' => $pi->id,
    ]);
    Award::create([
        'proposal_id' => $proposal->id, 'grant_reference' => 'GR-'.rand(10000, 99999),
        'approved_by' => $ctx->central->id, 'approved_at' => now()->subDays($daysAgo), 'awarded_amount' => 100000,
    ]);
    MidtermEvaluation::create(['proposal_id' => $proposal->id, 'evaluation_date' => now()->addMonth()->toDateString(), 'status' => 'scheduled', 'scheduled_by' => $ctx->central->id]);

    return $proposal;
}

function rk_release(object $ctx, Proposal $proposal, float $amount): void
{
    $request = BudgetRequest::create([
        'proposal_id' => $proposal->id, 'form_template_id' => $ctx->template->id,
        'requested_by' => $ctx->central->id, 'total_amount' => $amount, 'status' => 'approved',
    ]);
    Disbursement::create(['budget_request_id' => $request->id, 'disbursed_by' => $ctx->central->id, 'amount' => $amount, 'disbursed_at' => now()]);
}

function rk_report(Proposal $proposal, int $period, string $status, ?int $percent = null, ?float $spent = null, int $dueDaysAgo = 0): void
{
    ProgressReport::create([
        'proposal_id' => $proposal->id, 'period_number' => $period,
        'period_start' => now()->subMonths(3)->toDateString(), 'period_end' => now()->toDateString(),
        'due_date' => now()->subDays($dueDaysAgo)->toDateString(), 'status' => $status,
        'percent_complete' => $percent, 'budget_spent' => $spent,
        'submitted_at' => in_array($status, ['submitted', 'accepted'], true) ? now() : null,
    ]);
}

function rk_find(array $projects, Proposal $proposal): array
{
    return collect($projects)->firstWhere('id', $proposal->id);
}

test('a healthy project is on track', function () {
    $healthy = rk_project($this, 90);
    rk_release($this, $healthy, 30000);
    rk_report($healthy, 1, 'accepted', 30, 25000);

    $response = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/projects-at-risk')->assertOk();

    $project = rk_find($response->json('data.projects'), $healthy);
    expect($project['level'])->toBe('on_track')
        ->and($project['signals'])->toBe([])
        ->and($project['released_pct'])->toBe(30)
        ->and($response->json('data.summary.on_track'))->toBe(1);
});

test('a project past its end date is high risk', function () {
    $late = rk_project($this, 400);
    rk_release($this, $late, 90000);

    $project = rk_find($this->actingAs($this->central, 'sanctum')->getJson('/api/v1/projects-at-risk')->json('data.projects'), $late);

    expect($project['level'])->toBe('high')
        ->and(collect($project['signals'])->pluck('key')->all())->toContain('past_end')
        ->and($project['days_left'])->toBeLessThan(0);
});

test('no money released becomes serious after a quarter of the project', function () {
    $early = rk_project($this, 70);
    $later = rk_project($this, 120);

    $projects = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/projects-at-risk')->json('data.projects');

    expect(rk_find($projects, $early)['signals'][0])->toMatchArray(['key' => 'no_funds', 'level' => 'watch'])
        ->and(rk_find($projects, $later)['signals'][0])->toMatchArray(['key' => 'no_funds', 'level' => 'high'])
        ->and($projects[0]['id'])->toBe($later->id);
});

test('progress behind time, spending ahead of progress and overdue reports are flagged', function () {
    $project = rk_project($this, 240);
    rk_release($this, $project, 70000);
    rk_report($project, 1, 'accepted', 20, 60000);
    rk_report($project, 2, 'due', dueDaysAgo: 5);

    $found = rk_find($this->actingAs($this->central, 'sanctum')->getJson('/api/v1/projects-at-risk')->json('data.projects'), $project);
    $signals = collect($found['signals'])->keyBy('key');

    expect($signals->keys()->all())->toEqualCanonicalizing(['behind_schedule', 'overspending', 'reports_overdue'])
        ->and($signals['behind_schedule']['level'])->toBe('high')
        ->and($signals['reports_overdue']['level'])->toBe('watch')
        ->and($found['level'])->toBe('high');
});

test('a missing contract and midterm are watch signals', function () {
    $project = rk_project($this, 100, ['status' => 'funded', 'contract_status' => 'pending']);
    MidtermEvaluation::where('proposal_id', $project->id)->delete();
    rk_release($this, $project, 20000);

    $found = rk_find($this->actingAs($this->central, 'sanctum')->getJson('/api/v1/projects-at-risk')->json('data.projects'), $project);

    expect(collect($found['signals'])->pluck('key')->all())->toEqualCanonicalizing(['no_contract', 'midterm_overdue'])
        ->and($found['level'])->toBe('watch');
});

test('only running funded projects are assessed', function () {
    rk_project($this, 30);
    rk_project($this, 30, ['status' => 'completed']);
    rk_project($this, 30, ['status' => 'under_blind_review']);

    $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/projects-at-risk')->assertJsonPath('data.summary.total', 1);
});

test('a college officer sees only their own college, and researchers are refused', function () {
    $other = College::create(['name' => 'Other College', 'code' => 'RO'.rand(10000, 99999)]);
    rk_project($this, 30);
    rk_project($this, 30, [], $other);

    $officer = User::factory()->create(['college_id' => $this->college->id]);
    $officer->assignRole('college_officer');
    $this->actingAs($officer, 'sanctum')->getJson('/api/v1/projects-at-risk')
        ->assertOk()
        ->assertJsonPath('data.summary.total', 1)
        ->assertJsonPath('data.college_scoped', true);

    $pi = User::factory()->create();
    $pi->assignRole('pi');
    $this->actingAs($pi, 'sanctum')->getJson('/api/v1/projects-at-risk')->assertForbidden();
});

test('the list downloads as an Excel workbook, a CSV file and a PDF report', function () {
    $late = rk_project($this, 400);
    rk_project($this, 90);

    $this->actingAs($this->central, 'sanctum');

    $xlsx = $this->get('/api/v1/projects-at-risk/export?format=xlsx')->assertOk();
    $book = IOFactory::load($xlsx->getFile()->getPathname());
    expect($book->getSheetNames())->toBe(['Summary', 'Projects', 'Warnings'])
        ->and($book->getSheetByName('Projects')->getHighestRow())->toBe(3);

    $csv = $this->get('/api/v1/projects-at-risk/export?format=csv')->assertOk();
    $content = file_get_contents($csv->getFile()->getPathname());
    expect($content)->toStartWith("\u{FEFF}")->toContain('Risk Level')->toContain($late->tracker_number);

    $this->get('/api/v1/projects-at-risk/export?format=pdf')
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

test('downloads follow the filters on the page', function () {
    $late = rk_project($this, 400);
    $fine = rk_project($this, 90);
    rk_release($this, $fine, 30000);

    $csv = $this->actingAs($this->central, 'sanctum')->get('/api/v1/projects-at-risk/export?format=csv&level=high&signal=past_end')->assertOk();
    $content = file_get_contents($csv->getFile()->getPathname());

    expect($content)->toContain($late->tracker_number)->not->toContain($fine->tracker_number);

    $this->getJson('/api/v1/projects-at-risk/export?format=doc')->assertUnprocessable();
});

test('researchers cannot download the list', function () {
    $pi = User::factory()->create();
    $pi->assignRole('pi');

    $this->actingAs($pi, 'sanctum')->getJson('/api/v1/projects-at-risk/export?format=xlsx')->assertForbidden();
});

test('the research team sees their running project health, and outsiders do not', function () {
    $late = rk_project($this, 400);

    $this->actingAs(User::find($late->pi_user_id), 'sanctum')
        ->getJson("/api/v1/proposals/{$late->id}/health")
        ->assertOk()
        ->assertJsonPath('data.level', 'high')
        ->assertJsonPath('data.signals.0.key', 'past_end');

    $stranger = User::factory()->create();
    $stranger->assignRole('pi');
    $this->actingAs($stranger, 'sanctum')->getJson("/api/v1/proposals/{$late->id}/health")->assertForbidden();
});

test('a project that is not running has no health card', function () {
    $done = rk_project($this, 30, ['status' => 'completed']);

    $this->actingAs($this->central, 'sanctum')->getJson("/api/v1/proposals/{$done->id}/health")->assertOk()->assertJsonPath('data', null);
});

test('the weekly digest reaches monitors in scope and the PI of each high-risk project', function () {
    $late = rk_project($this, 400);
    rk_project($this, 90);
    $otherCollege = College::create(['name' => 'Far College', 'code' => 'RF'.rand(10000, 99999)]);
    $farOfficer = User::factory()->create(['college_id' => $otherCollege->id]);
    $farOfficer->assignRole('college_officer');

    $this->artisan('rtt:risk-digest')->assertSuccessful();

    $digest = DB::table('notifications')->where('notifiable_id', $this->central->id)->where('type', 'risk_digest')->first();
    expect($digest)->not->toBeNull()
        ->and(json_decode($digest->data, true)['message'])->toContain($late->tracker_number)
        ->and(DB::table('notifications')->where('notifiable_id', $late->pi_user_id)->where('type', 'project_health_warning')->exists())->toBeTrue()
        ->and(DB::table('notifications')->where('notifiable_id', $farOfficer->id)->exists())->toBeFalse();
});
