<?php

use App\Models\College;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Models\User;
use App\Services\ResearchOutputService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    Queue::fake();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ro_makeBase(string $status = 'funded'): array
{
    $college = College::create(['name' => 'RO College '.rand(), 'code' => 'RO'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'RD'.rand(10, 99)]);

    $central = User::factory()->create(); $central->assignRole('central_officer');
    $pi      = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]); $pi->assignRole('staff');

    foreach ([$central, $pi] as $u) {
        NotificationPreference::firstOrCreate(['user_id' => $u->id], [
            'email_enabled' => false, 'telegram_enabled' => false, 'inapp_enabled' => true,
        ]);
    }

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'Call', 'slug' => 'ro-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $central->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id, 'category' => 'research',
        'title'            => 'RO Proposal', 'status' => $status,
        'pi_user_id'       => $pi->id, 'college_id' => $college->id,
        'department_id'    => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
    ]);

    return [$proposal, $pi, $central];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('PI can record journal article output for funded proposal', function () {
    [$proposal, $pi] = ro_makeBase('funded');

    $output = app(ResearchOutputService::class)->record($proposal, 'journal_article', [
        'title'       => 'Machine Learning in Agricultural Water Management',
        'description' => 'A comprehensive study on ML applications.',
        'journal_name'=> 'Ethiopian Journal of Science',
        'year'        => 2026,
        'doi'         => '10.1234/ejs.2026.001',
    ], $pi);

    expect($output)->toBeInstanceOf(ResearchOutput::class)
        ->and($output->output_type)->toBe('journal_article')
        ->and($output->title)->toBe('Machine Learning in Agricultural Water Management');
});

test('journal article creates publication child record', function () {
    [$proposal, $pi] = ro_makeBase('funded');

    $output = app(ResearchOutputService::class)->record($proposal, 'journal_article', [
        'title'        => 'Protein Folding Analysis',
        'journal_name' => 'Journal of Biochemistry',
        'year'         => 2026,
        'doi'          => '10.1234/jb.2026.001',
    ], $pi);

    expect($output->publication)->not->toBeNull()
        ->and($output->publication->journal_name)->toBe('Journal of Biochemistry')
        ->and($output->publication->year)->toBe(2026);
});

test('PI can record patent output', function () {
    [$proposal, $pi] = ro_makeBase('funded');

    $output = app(ResearchOutputService::class)->record($proposal, 'patent', [
        'title'        => 'Solar-Powered Water Purification Device',
        'patent_number'=> 'ETH-2026-001',
        'jurisdiction' => 'Ethiopia',
        'filing_date'  => '2026-03-01',
        'status'       => 'filed',
    ], $pi);

    expect($output->output_type)->toBe('patent')
        ->and($output->patent)->not->toBeNull()
        ->and($output->patent->patent_number)->toBe('ETH-2026-001');
});

test('PI can record community impact output', function () {
    [$proposal, $pi] = ro_makeBase('funded');

    $output = app(ResearchOutputService::class)->record($proposal, 'community_impact', [
        'title'             => 'Improved Irrigation for 500 Farmers',
        'beneficiary_count' => 500,
        'location'          => 'Harari Region',
        'impact_category'   => 'agriculture',
    ], $pi);

    expect($output->output_type)->toBe('community_impact')
        ->and($output->communityImpact)->not->toBeNull()
        ->and($output->communityImpact->beneficiary_count)->toBe(500);
});

test('cannot record output for draft proposal', function () {
    [$proposal, $pi] = ro_makeBase('draft');

    expect(fn () => app(ResearchOutputService::class)->record($proposal, 'journal_article', [
        'title' => 'Draft Output',
    ], $pi))->toThrow(\Exception::class, 'status: draft');
});

test('repository record updated when output added', function () {
    [$proposal, $pi] = ro_makeBase('funded');

    // Pre-create the repository record
    RepositoryRecord::create([
        'proposal_id'  => $proposal->id,
        'title'        => $proposal->title,
        'abstract'     => 'Test',
        'category'     => $proposal->category,
        'college_id'   => $proposal->college_id,
        'pi_name'      => $pi->name,
        'academic_year'=> '2026',
        'status'       => 'published',
    ]);

    app(ResearchOutputService::class)->record($proposal, 'journal_article', [
        'title' => 'Update Test Article', 'journal_name' => 'Test Journal', 'year' => 2026,
    ], $pi);

    $record = RepositoryRecord::where('proposal_id', $proposal->id)->first();
    expect($record->total_outputs)->toBe(1)
        ->and($record->publications_count)->toBe(1);
});

test('Central Office notified when output recorded', function () {
    [$proposal, $pi, $central] = ro_makeBase('funded');

    Queue::fake();
    app(ResearchOutputService::class)->record($proposal, 'journal_article', [
        'title' => 'Notification Test', 'year' => 2026,
    ], $pi);

    Queue::assertPushed(\App\Jobs\StoreInAppNotificationJob::class, fn ($job) =>
        $job->userId === $central->id && $job->event === 'output_recorded'
    );
});
