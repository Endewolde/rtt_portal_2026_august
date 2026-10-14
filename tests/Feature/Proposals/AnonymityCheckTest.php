<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalDocument;
use App\Models\ProposalMember;
use App\Models\User;
use App\Services\AnonymityCheckService;
use App\Services\WorkflowService;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();
    Storage::fake('private');

    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $college = College::create(['name' => 'C'.rand(), 'code' => 'AN'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'AND'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'an-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);

    $this->pi = User::factory()->create(['name' => 'Dr. Abebe Kebede Tesfaye', 'email' => 'abebe.k@wsu.edu.et', 'phone' => '+251 911 234 567']);
    $this->pi->assignRole('staff');

    $this->proposal = Proposal::create([
        'tracker_number' => 'AN-1', 'proposal_call_id' => $call->id, 'category' => 'research',
        'title' => 'Soil Erosion Study', 'abstract' => 'We study soil erosion in the highlands.',
        'status' => 'draft', 'pi_user_id' => $this->pi->id, 'college_id' => $college->id,
        'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $this->pi->id,
    ]);
});

/** Store a real .docx (body + header) as the proposal's current proposal document. */
function an_docx(Proposal $proposal, string $body, string $header = ''): ProposalDocument
{
    $tmp = tempnam(sys_get_temp_dir(), 'docx');
    $zip = new ZipArchive;
    $zip->open($tmp, ZipArchive::OVERWRITE);
    $zip->addFromString('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>'.htmlspecialchars($body).'</w:t></w:r></w:p></w:body></w:document>');
    if ($header !== '') {
        $zip->addFromString('word/header1.xml', '<w:hdr><w:p><w:r><w:t>'.htmlspecialchars($header).'</w:t></w:r></w:p></w:hdr>');
    }
    $zip->close();

    $path = "proposals/{$proposal->id}/documents/proposal.docx";
    Storage::disk('private')->put($path, file_get_contents($tmp));
    unlink($tmp);

    return ProposalDocument::create([
        'proposal_id' => $proposal->id, 'document_type' => 'proposal_document', 'version' => 1, 'is_current' => true,
        'original_filename' => 'proposal.docx', 'stored_path' => $path, 'file_size' => 1000,
        'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'uploaded_by' => $proposal->pi_user_id,
    ]);
}

test('submitting a proposal whose document names the PI flags it', function () {
    an_docx($this->proposal, 'Background and objectives of the study.', 'Prepared by Abebe Kebede, Department of Soil Science');

    app(WorkflowService::class)->transition($this->proposal, 'submit', $this->pi);

    $proposal = $this->proposal->fresh();
    expect($proposal->anonymity_status)->toBe(AnonymityCheckService::STATUS_ISSUES)
        ->and($proposal->anonymity_checked_at)->not->toBeNull()
        ->and($proposal->anonymity_findings['findings'][0]['type'])->toBe('name')
        ->and($proposal->anonymity_findings['findings'][0]['snippet'])->toContain('abebe kebede')
        ->and($proposal->anonymity_findings['findings'][0]['person'])->toContain('Principal Investigator');
});

test('the father and grandfather name pair is enough to flag', function () {
    an_docx($this->proposal, 'Contact Kebede Tesfaye for the data.');

    $result = app(AnonymityCheckService::class)->check($this->proposal);

    expect($result['status'])->toBe('issues')
        ->and(collect($result['findings'])->pluck('value'))->toContain('kebede tesfaye');
});

test('a lone first name is not flagged', function () {
    an_docx($this->proposal, 'Farmers such as Abebe in the study area reported soil loss.');

    expect(app(AnonymityCheckService::class)->check($this->proposal)['status'])->toBe('clean');
});

test('a co-investigator\'s email in the abstract is flagged against the proposal form', function () {
    $co = User::factory()->create(['name' => 'Almaz Haile', 'email' => 'almaz.h@wsu.edu.et']);
    ProposalMember::create(['proposal_id' => $this->proposal->id, 'user_id' => $co->id, 'role' => 'co_investigator', 'status' => 'active', 'joined_at' => now()]);
    $this->proposal->update(['abstract' => 'For questions write to almaz.h@wsu.edu.et.']);
    an_docx($this->proposal, 'Methods section.');

    $result = app(AnonymityCheckService::class)->check($this->proposal);
    $email = collect($result['findings'])->firstWhere('type', 'email');

    expect($email['source'])->toBe('Proposal form (title, abstract, keywords)')
        ->and($email['person'])->toBe('Co-investigator: Almaz Haile');
});

test('the PI\'s phone number is flagged however it is formatted', function () {
    an_docx($this->proposal, 'Call 0911-234-567 for field visits.');

    expect(collect(app(AnonymityCheckService::class)->check($this->proposal)['findings'])->pluck('type'))->toContain('phone');
});

test('a clean document passes', function () {
    an_docx($this->proposal, 'Soil erosion reduces yields across the Wolaita highlands.');

    expect(app(AnonymityCheckService::class)->check($this->proposal)['status'])->toBe('clean');
});

test('with no readable reviewer document the check asks for a manual review', function () {
    expect(app(AnonymityCheckService::class)->check($this->proposal)['status'])->toBe('not_checked');
});

test('officers can re-run the check; staff cannot', function () {
    an_docx($this->proposal, 'Prepared by Abebe Kebede.');

    $this->actingAs($this->central, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/anonymity-check")
        ->assertOk()
        ->assertJsonPath('data.status', 'issues')
        ->assertJsonPath('message', '1 possible identity reveal(s) found.');

    $this->actingAs($this->pi, 'sanctum')
        ->postJson("/api/v1/proposals/{$this->proposal->id}/anonymity-check")
        ->assertForbidden();
});

test('the backfill command checks existing proposals and reports what it found', function () {
    $this->proposal->update(['status' => 'validated']);
    an_docx($this->proposal, 'Prepared by Abebe Kebede.');

    Artisan::call('proposals:check-anonymity');

    expect(Artisan::output())->toContain('1 with possible identity reveals')->toContain('AN-1')
        ->and($this->proposal->fresh()->anonymity_status)->toBe('issues');
});
