<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMember;
use App\Models\Publication;
use App\Models\ResearchOutput;
use App\Models\User;
use App\Services\PersonalDataService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();

    $this->college = College::create(['name' => 'College of Agriculture', 'code' => 'RP'.rand(10000, 99999)]);
    $this->dept = Department::create(['college_id' => $this->college->id, 'name' => 'Plant Science', 'code' => 'RPD'.rand(10000, 99999)]);

    $this->researcher = User::factory()->create([
        'name' => 'Almaz Bekele', 'title' => 'Dr.', 'college_id' => $this->college->id, 'department_id' => $this->dept->id,
        'email' => 'almaz@example.test', 'phone' => '0911000000', 'expertise' => ['Soil science', 'Agronomy'],
    ]);
    $this->researcher->assignRole('staff');

    $call = ProposalCall::create([
        'academic_year' => '2025', 'category' => 'research', 'title' => 'Call', 'slug' => 'rp-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->researcher->id,
    ]);
    $this->makeProject = function (string $status, ?User $pi = null, string $title = 'Soil fertility mapping') use ($call): Proposal {
        $pi ??= $this->researcher;

        return Proposal::create([
            'tracker_number' => 'RP-'.rand(100000, 999999), 'proposal_call_id' => $call->id, 'category' => 'research',
            'title' => $title, 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $this->college->id,
            'department_id' => $this->dept->id, 'academic_year' => '2025', 'created_by' => $pi->id, 'focus_area' => 'Soil health',
        ]);
    };
});

function rp_turnOn(User $user, array $extra = [])
{
    return test()->actingAs($user, 'sanctum')->putJson('/api/v1/profile/public-profile', ['public_profile' => true] + $extra);
}

test('a profile is private until the researcher switches it on', function () {
    ($this->makeProject)('funded');

    $this->getJson('/api/v1/researchers')->assertOk()->assertJsonCount(0, 'data.data');

    $slug = rp_turnOn($this->researcher)->assertOk()->json('data.profile_slug');

    expect($slug)->toBe('almaz-bekele');
    $this->getJson('/api/v1/researchers')->assertOk()->assertJsonPath('data.data.0.slug', 'almaz-bekele');
    $this->getJson('/api/v1/researchers/almaz-bekele')->assertOk()->assertJsonPath('data.name', 'Almaz Bekele');

    $this->actingAs($this->researcher, 'sanctum')->putJson('/api/v1/profile/public-profile', ['public_profile' => false])->assertOk();
    $this->getJson('/api/v1/researchers/almaz-bekele')->assertNotFound();
});

test('the public page shows funded projects, their themes and checked outputs — never contact details or drafts', function () {
    $ongoing = ($this->makeProject)('funded');
    $done = ($this->makeProject)('completed', title: 'Composting for smallholders');
    ($this->makeProject)('under_blind_review', title: 'Still in review');

    $other = User::factory()->create();
    $asMember = ($this->makeProject)('midterm_evaluation', $other, 'Shared irrigation study');
    ProposalMember::create(['proposal_id' => $asMember->id, 'user_id' => $this->researcher->id, 'role' => 'co_investigator', 'status' => 'active', 'joined_at' => now()]);

    $approved = ResearchOutput::create(['proposal_id' => $done->id, 'output_type' => 'journal_article', 'title' => 'Compost and yield', 'recorded_by' => $this->researcher->id, 'status' => 'approved']);
    Publication::create(['research_output_id' => $approved->id, 'doi' => '10.1000/compost', 'journal_name' => 'Soil Journal', 'year' => 2025]);
    ResearchOutput::create(['proposal_id' => $ongoing->id, 'output_type' => 'journal_article', 'title' => 'Unchecked draft', 'recorded_by' => $this->researcher->id, 'status' => 'pending']);

    rp_turnOn($this->researcher, ['bio' => 'Works on soil health.', 'orcid' => 'https://orcid.org/0000-0002-1825-0097']);

    $response = $this->getJson('/api/v1/researchers/almaz-bekele')->assertOk();
    $data = $response->json('data');

    expect(collect($data['projects'])->pluck('title')->all())->toEqualCanonicalizing(['Soil Fertility Mapping', 'Composting for Smallholders', 'Shared Irrigation Study'])
        ->and(collect($data['projects'])->firstWhere('title', 'Shared Irrigation Study')['role'])->toBe('Co-investigator')
        ->and(collect($data['projects'])->firstWhere('title', 'Composting for Smallholders')['state'])->toBe('Completed')
        ->and($data['stats'])->toMatchArray(['projects' => 3, 'as_pi' => 2, 'ongoing' => 2, 'outputs' => 1])
        ->and($data['outputs'][0])->toMatchArray(['title' => 'Compost and yield', 'doi' => '10.1000/compost', 'venue' => 'Soil Journal'])
        ->and($data['themes'])->toBe(['Soil health'])
        ->and($data['orcid'])->toBe('0000-0002-1825-0097')
        ->and($data['bio'])->toBe('Works on soil health.');

    $body = $response->getContent();
    expect($body)->not->toContain('almaz@example.test')
        ->and($body)->not->toContain('0911000000')
        ->and($body)->not->toContain('Still In Review')
        ->and($body)->not->toContain('Unchecked draft');
});

test('a suspended researcher\'s profile is hidden even if switched on', function () {
    rp_turnOn($this->researcher)->assertOk();
    $this->researcher->update(['status' => 'suspended']);

    $this->getJson('/api/v1/researchers/almaz-bekele')->assertNotFound();
});

test('the directory searches by name and expertise', function () {
    rp_turnOn($this->researcher);
    $other = User::factory()->create(['name' => 'Tesfaye Alemu', 'expertise' => ['Hydrology']]);
    rp_turnOn($other);

    expect(collect($this->getJson('/api/v1/researchers?q=hydro')->json('data.data'))->pluck('name')->all())->toBe(['Tesfaye Alemu'])
        ->and(collect($this->getJson('/api/v1/researchers?q=almaz')->json('data.data'))->pluck('name')->all())->toBe(['Almaz Bekele']);
});

test('the profile address must be unique and well-formed, and the ORCID iD valid', function () {
    $other = User::factory()->create();
    rp_turnOn($other, ['profile_slug' => 'taken-name']);

    rp_turnOn($this->researcher, ['profile_slug' => 'taken-name'])->assertUnprocessable()->assertJsonValidationErrors('profile_slug');
    rp_turnOn($this->researcher, ['profile_slug' => 'Bad Name!'])->assertUnprocessable()->assertJsonValidationErrors('profile_slug');
    rp_turnOn($this->researcher, ['orcid' => '1234'])->assertUnprocessable()->assertJsonValidationErrors('orcid');
});

test('two researchers with the same name get different addresses', function () {
    $twin = User::factory()->create(['name' => 'Almaz Bekele']);

    expect(rp_turnOn($this->researcher)->json('data.profile_slug'))->toBe('almaz-bekele')
        ->and(rp_turnOn($twin)->json('data.profile_slug'))->toBe('almaz-bekele-2');
});

test('removing a person\'s personal data takes their public profile down', function () {
    rp_turnOn($this->researcher, ['bio' => 'About me.'])->assertOk();

    app(PersonalDataService::class)->anonymise($this->researcher);

    $this->getJson('/api/v1/researchers/almaz-bekele')->assertNotFound();
    expect($this->researcher->fresh())->public_profile->toBeFalse()->bio->toBeNull();
});

test('the directory browses A–Z ten at a time, with counts per letter and extra filters', function () {
    $otherDept = Department::create(['college_id' => $this->college->id, 'name' => 'Animal Science', 'code' => 'RPA'.rand(10000, 99999)]);
    foreach (range(1, 11) as $i) {
        User::factory()->create(['name' => "Abebe Tadesse {$i}", 'public_profile' => true, 'profile_slug' => "abebe-{$i}", 'status' => 'active', 'college_id' => $this->college->id, 'department_id' => $otherDept->id]);
    }
    User::factory()->create(['name' => 'Bethlehem Kebede', 'public_profile' => true, 'profile_slug' => 'bethlehem', 'status' => 'active']);
    ($this->makeProject)('funded');
    rp_turnOn($this->researcher);

    $all = $this->getJson('/api/v1/researchers')->assertOk();
    expect($all->json('data.data'))->toHaveCount(10)
        ->and($all->json('data.total'))->toBe(13)
        ->and($all->json('meta.letters'))->toBe(['A' => 12, 'B' => 1]);

    $this->getJson('/api/v1/researchers?letter=b')->assertOk()
        ->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.slug', 'bethlehem');

    $this->getJson('/api/v1/researchers?department_id='.$this->dept->id)->assertOk()
        ->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.slug', 'almaz-bekele');

    $this->getJson('/api/v1/researchers?with_projects=1')->assertOk()
        ->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.slug', 'almaz-bekele');

    $this->getJson('/api/v1/researchers?sort=name_desc')->assertOk()->assertJsonPath('data.data.0.slug', 'bethlehem');
});
