<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\AnnualReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $college = College::create(['name' => 'Annual College', 'code' => 'AR'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'ARD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'ar-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);

    foreach (['funded', 'midterm_evaluation', 'completed', 'rejected', 'under_blind_review', 'draft'] as $status) {
        $pi = User::factory()->create();
        Proposal::create([
            'tracker_number' => 'AR-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
            'title' => 'Annual '.$status, 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id,
            'department_id' => $dept->id, 'academic_year' => '2026-2027', 'created_by' => $pi->id,
        ]);
    }
});

test('the annual report counts every funded project, including those at mid-term or completed', function () {
    $response = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/annual-report/preview?academic_year=2026-2027')->assertOk();

    expect($response->json('data.proposals.total'))->toBe(5)
        ->and($response->json('data.proposals.funded'))->toBe(3)
        ->and($response->json('data.colleges.0.submitted'))->toBe(5)
        ->and($response->json('data.colleges.0.funded'))->toBe(3)
        ->and($response->json('meta.academic_years'))->toBe(['2026-2027']);
});

test('a section that fails to compile leaves the rest of the report readable and is named', function () {
    // As if the impacts table were missing or broken on the server.
    $this->app->instance(AnnualReportService::class, new class extends AnnualReportService
    {
        protected function impacts(string $ay): array
        {
            throw new RuntimeException('Table research_impacts does not exist');
        }
    });

    $response = $this->actingAs($this->central, 'sanctum')->getJson('/api/v1/annual-report/preview?academic_year=2026-2027')->assertOk();

    expect($response->json('data.proposals.total'))->toBe(5)
        ->and($response->json('data.impacts.total'))->toBe(0)
        ->and($response->json('data.unavailable'))->toBe(['impacts']);
});

test('the annual report downloads as a PDF', function () {
    $response = $this->actingAs($this->central, 'sanctum')->get('/api/v1/annual-report/download?academic_year=2026-2027')->assertOk();

    expect($response->headers->get('content-type'))->toContain('application/pdf')
        ->and(substr($response->getContent(), 0, 4))->toBe('%PDF');
});

test('when the PDF fails with the Ethiopic font it falls back to the standard fonts, and logs why', function () {
    $calls = [];
    $working = Mockery::mock(Barryvdh\DomPDF\PDF::class);
    $working->shouldReceive('setPaper', 'setOption')->andReturnSelf();
    $working->shouldReceive('download')->andReturn(response('%PDF-fallback', 200, ['Content-Type' => 'application/pdf']));

    Pdf::shouldReceive('loadView')->twice()->andReturnUsing(function (string $view, array $data) use (&$calls, $working) {
        $calls[] = $data['standardFontsOnly'];
        if (! $data['standardFontsOnly']) {
            throw new RuntimeException('Unable to write font cache');
        }

        return $working;
    });
    Log::spy();

    $this->actingAs($this->central, 'sanctum')->get('/api/v1/annual-report/download?academic_year=2026-2027')->assertOk();

    expect($calls)->toBe([false, true]);
    Log::shouldHaveReceived('error')->withArgs(fn ($message) => str_contains($message, 'Unable to write font cache'))->once();
});
