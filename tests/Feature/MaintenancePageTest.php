<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Support\MaintenancePageData;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    DB::table('app_settings')->where('key', 'current_academic_year')->update(['value' => '2026-2027']);

    $this->pi = User::factory()->create(['name' => 'Private Applicant Name']);
    $this->college = College::create(['name' => 'College of Engineering', 'code' => 'MPE'.rand(1000, 9999), 'status' => 'active']);
    $this->dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'MPD'.rand(1000, 9999)]);
    $this->call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Research Grants Round 2026', 'slug' => 'mp-'.rand(1000, 9999),
        'start_date' => now()->subDay()->toDateString(), 'end_date' => now()->addDays(10)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->pi->id,
    ]);
});

function mp_proposal(object $ctx, string $status, string $title, string $year = '2026-2027'): Proposal
{
    return Proposal::create([
        'tracker_number' => 'MP-'.rand(100000, 999999), 'proposal_call_id' => $ctx->call->id, 'category' => 'research',
        'title' => $title, 'status' => $status, 'pi_user_id' => $ctx->pi->id, 'college_id' => $ctx->college->id,
        'department_id' => $ctx->dept->id, 'academic_year' => $year, 'created_by' => $ctx->pi->id,
    ]);
}

test('the maintenance page figures count this year\'s submitted proposals, those in review and all funded projects', function () {
    mp_proposal($this, 'submitted', 'A');
    mp_proposal($this, 'under_blind_review', 'B');
    mp_proposal($this, 'under_open_defence', 'C');
    mp_proposal($this, 'funded', 'Solar irrigation for smallholder farms');
    mp_proposal($this, 'rejected', 'Rejected at validation');
    mp_proposal($this, 'draft', 'Unsubmitted draft');
    mp_proposal($this, 'funded', 'Last year project', '2025-2026');

    $data = MaintenancePageData::collect();

    expect($data['academic_year'])->toBe('2026-2027')
        ->and($data['stats']['submitted'])->toBe(5) // every submitted proposal this year, the rejected one too — not drafts or other years
        ->and($data['stats']['in_review'])->toBe(2)
        ->and($data['stats']['funded'])->toBe(2); // all years
});

test('the maintenance page shows the figures but no proposal titles or applicants', function () {
    mp_proposal($this, 'funded', 'Solar irrigation for smallholder farms');
    mp_proposal($this, 'under_blind_review', 'Confidential proposal under review');

    $html = strtolower(view('errors.503')->render()); // titles are stored in title case

    expect($html)->toContain('proposals this year')
        ->toContain('projects funded')
        ->not->toContain('solar irrigation for smallholder farms')
        ->not->toContain('confidential proposal under review')
        ->not->toContain('private applicant name')
        ->not->toContain('how proposals move');
});

test('admins can preview the maintenance page before switching it on', function () {
    $this->get('/maintenance-preview')
        ->assertOk()
        ->assertSee('Scheduled maintenance')
        ->assertHeader('X-Robots-Tag', 'noindex');
});

test('only the maintenance page may be framed, and only by this site — it covers the public site for the admin', function () {
    expect($this->get('/maintenance-preview')->headers->get('Content-Security-Policy'))->toContain("frame-ancestors 'self'");
    expect($this->get('/')->headers->get('Content-Security-Policy'))->toContain("frame-ancestors 'none'");
});
