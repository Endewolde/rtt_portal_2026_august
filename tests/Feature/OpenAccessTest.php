<?php

use App\Models\AppSetting;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\RepositoryRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

/** @return array{proposal_id: string, college_id: string} */
function oa_proposal(): array
{
    $user = User::factory()->create();
    $college = College::create(['name' => 'OA '.rand(), 'code' => 'OA'.rand(10000, 99999), 'status' => 'active']);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'OAD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2025-2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'oa-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'status' => 'active', 'is_open' => true, 'created_by' => $user->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number' => 'OA-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'P', 'status' => 'completed',
        'pi_user_id' => $user->id, 'college_id' => $college->id, 'department_id' => $dept->id, 'academic_year' => '2025-2026', 'created_by' => $user->id,
    ]);

    return ['proposal_id' => $proposal->id, 'college_id' => $college->id];
}

beforeEach(function () {
    AppSetting::updateOrCreate(['key' => 'organization_name'], ['value' => 'Wolaita Sodo University']);
    $this->published = RepositoryRecord::create([
        ...oa_proposal(),
        'title' => 'Groundwater Quality In Rural Wolaita', 'abstract' => 'We sampled <b>120</b> wells.', 'keywords' => 'water, sanitation; health',
        'category' => 'research', 'pi_name' => 'Almaz Bekele', 'academic_year' => '2025-2026', 'status' => 'published',
    ]);
    $this->archived = RepositoryRecord::create([
        ...oa_proposal(), 'title' => 'Withdrawn Study', 'abstract' => 'Not public.', 'category' => 'research', 'pi_name' => 'Hidden Person', 'academic_year' => '2025-2026', 'status' => 'archived',
    ]);
});

test('a published record has its own page that tells search engines and Google Scholar what it is', function () {
    $html = $this->get("/repository/{$this->published->id}")->assertOk()->getContent();

    expect($html)->toContain('<meta name="citation_title" content="'.$this->published->title.'">')
        ->toContain('<meta name="citation_author" content="Almaz Bekele">')
        ->toContain('<meta name="citation_publication_date" content="2026">')
        ->toContain('"@type":"ResearchProject"')
        ->toContain('<title inertia>'.$this->published->title.' · Wolaita Sodo University</title>');

    $this->get("/repository/{$this->archived->id}")->assertNotFound();
});

test('the public record API no longer shows archived records or the proposal behind a record', function () {
    $this->getJson("/api/v1/repository/{$this->archived->id}")->assertNotFound();
    $this->getJson("/api/v1/repository/{$this->published->id}")->assertOk()->assertJsonMissingPath('data.proposal');
});

test('the sitemap lists published records and leaves out switched-off pages', function () {
    $xml = $this->get('/sitemap.xml')->assertOk()->assertHeader('content-type', 'application/xml; charset=utf-8')->getContent();
    expect($xml)->toContain("/repository/{$this->published->id}")->not->toContain($this->archived->id);

    AppSetting::updateOrCreate(['key' => 'public_nav_item_6_show'], ['value' => 'false']);
    Cache::forget('public_closed_pages');
    expect($this->get('/sitemap.xml')->getContent())->not->toContain('/repository');
});

test('OAI-PMH answers harvesters with Dublin Core records of published work only', function () {
    $identify = $this->get('/oai?verb=Identify')->assertOk()->getContent();
    expect($identify)->toContain('<repositoryName>Wolaita Sodo University Research Repository</repositoryName>')->toContain('<protocolVersion>2.0</protocolVersion>');

    $list = $this->get('/oai?verb=ListRecords&metadataPrefix=oai_dc')->assertOk()->getContent();
    expect($list)->toContain('<dc:title>'.$this->published->title.'</dc:title>')
        ->toContain('<dc:subject>sanitation</dc:subject>')
        ->toContain('<dc:description>We sampled 120 wells.</dc:description>')
        ->not->toContain('Withdrawn Study');

    $id = 'oai:'.parse_url(config('app.url'), PHP_URL_HOST).':repository/'.$this->published->id;
    expect($this->get('/oai?verb=GetRecord&metadataPrefix=oai_dc&identifier='.urlencode($id))->getContent())->toContain('<dc:creator>Almaz Bekele</dc:creator>');

    expect($this->get('/oai?verb=Nope')->getContent())->toContain('<error code="badVerb">')
        ->and($this->get('/oai?verb=ListRecords&metadataPrefix=marc')->getContent())->toContain('cannotDisseminateFormat')
        ->and($this->get('/oai?verb=ListRecords&metadataPrefix=oai_dc&from=2999-01-01')->getContent())->toContain('noRecordsMatch')
        ->and($this->get('/oai?verb=ListRecords&resumptionToken=garbage')->getContent())->toContain('badResumptionToken');
});
