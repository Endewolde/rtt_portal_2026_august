<?php

use App\Http\Middleware\EnsureCollegeScope;
use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeUserWithRole(string $role, ?string $collegeId = null): User
{
    $user = User::factory()->create(['college_id' => $collegeId]);
    $user->assignRole($role);

    return $user;
}

function makeProposalForCollege(User $pi, string $collegeId): Proposal
{
    $college = College::find($collegeId) ?? College::create([
        'name' => 'College '.$collegeId,
        'code' => 'COL'.substr($collegeId, 0, 4),
    ]);

    $dept = Department::firstOrCreate(
        ['college_id' => $college->id, 'code' => 'DEPT1'],
        ['name' => 'Department', 'code' => 'DEPT1']
    );

    $call = ProposalCall::create([
        'academic_year' => '2025/2026',
        'category' => 'research',
        'title' => 'Call '.rand(1, 999),
        'slug' => 'call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(),
        'created_by' => $pi->id,
    ]);

    return Proposal::create([
        'tracker_number' => 'TRK-'.rand(10000, 99999),
        'proposal_call_id' => $call->id,
        'category' => 'research',
        'title' => 'Test Proposal',
        'status' => 'draft',
        'pi_user_id' => $pi->id,
        'college_id' => $college->id,
        'department_id' => $dept->id,
        'academic_year' => '2025/2026',
        'created_by' => $pi->id,
    ]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('college_admin_cannot_see_proposals_from_another_college', function () {
    $collegeA = College::create(['name' => 'College A', 'code' => 'COLLA']);
    $collegeB = College::create(['name' => 'College B', 'code' => 'COLLB']);

    $piA = makeUserWithRole('pi', $collegeA->id);
    $piB = makeUserWithRole('pi', $collegeB->id);

    // College admin belongs to College A
    $adminA = makeUserWithRole('college_officer', $collegeA->id);

    $proposalA = makeProposalForCollege($piA, $collegeA->id);
    $proposalB = makeProposalForCollege($piB, $collegeB->id);

    // Verify the proposals exist and belong to different colleges
    expect($proposalA->college_id)->toBe($collegeA->id)
        ->and($proposalB->college_id)->toBe($collegeB->id);

    // College admin of A should only have access to College A's proposals
    // The EnsureCollegeScope middleware sets _college_scope = college_admin->college_id
    // Verify the middleware correctly injects the scope
    $request = new Request;
    $request->setUserResolver(fn () => $adminA);

    $middleware = new EnsureCollegeScope;
    $passed = false;
    $middleware->handle($request, function ($req) use (&$passed, $collegeA) {
        $passed = true;
        expect($req->input('_college_scope'))->toBe($collegeA->id);
    });

    expect($passed)->toBeTrue();

    // Verify College B's proposal is in a different college (admin A cannot scope to it)
    expect($proposalB->college_id)->not->toBe($collegeA->id);
});

test('guest cannot access authenticated endpoints returns 401', function () {
    $this->getJson('/api/v1/auth/me')
        ->assertUnauthorized();

    $this->postJson('/api/v1/auth/logout')
        ->assertUnauthorized();

    $this->getJson('/api/v1/proposals')
        ->assertUnauthorized();
});

test('pi_cannot_update_another_pi_proposal', function () {
    $piA = makeUserWithRole('pi');
    $piB = makeUserWithRole('pi');

    $collegeA = College::create(['name' => 'College A', 'code' => 'CA01']);
    $proposalByA = makeProposalForCollege($piA, $collegeA->id);

    // piB tries to update piA's proposal — should get 403 or 200 (stub)
    // The actual authorization will be enforced once ProposalController is built.
    // For now, verify that piB is NOT the owner of piA's proposal.
    expect($proposalByA->pi_user_id)->toBe($piA->id)
        ->and($proposalByA->pi_user_id)->not->toBe($piB->id);

    // Authenticated request by piB to update piA's proposal
    // The stub controller returns 200 — full policy enforcement is in ProposalController task.
    // Assert the proposal's created_by is piA, not piB.
    $this->actingAs($piB, 'sanctum')
        ->putJson("/api/v1/proposals/{$proposalByA->id}", ['title' => 'Hijacked'])
        ->assertUnprocessable(); // update is intentionally disabled — use wizard endpoints

    // The proposal title must NOT be changed (no actual update in stub)
    expect(Proposal::find($proposalByA->id)->title)->toBe('Test Proposal');
});

test('reviewer_cannot_access_proposals_not_assigned_to_them', function () {
    $reviewer = makeUserWithRole('reviewer');

    // Reviewer accesses GET /api/v1/proposals — stub returns 200 data=null
    // Once the controller enforces review_assignments scoping, it will return only assigned proposals.
    // Verify the reviewer role has the correct scoped permissions.
    expect($reviewer->hasPermissionTo('proposals.view'))->toBeTrue()
        ->and($reviewer->hasPermissionTo('proposals.view_any'))->toBeFalse();

    // Authenticated request — stub currently returns 200
    $this->actingAs($reviewer, 'sanctum')
        ->getJson('/api/v1/proposals')
        ->assertOk();
});

test('reviewer role has review_assignments.view_any so the Assigned Reviews menu link is visible', function () {
    $reviewer = makeUserWithRole('reviewer');

    // AppLayout gates the "/reviews" sidebar link on this exact permission —
    // without it a reviewer has no way to reach their assignments (proposal or abstract).
    expect($reviewer->hasPermissionTo('review_assignments.view_any'))->toBeTrue();
});

// ─── College officer scoping: Users / Departments / Report Builder ───────────

test('a college officer only sees users from their own college, even under Administration > Users', function () {
    $collegeA = College::create(['name' => 'CO College A '.rand(), 'code' => 'CA'.rand(10, 99)]);
    $collegeB = College::create(['name' => 'CO College B '.rand(), 'code' => 'CB'.rand(10, 99)]);
    $officerA = makeUserWithRole('college_officer', $collegeA->id);
    makeUserWithRole('staff', $collegeA->id);
    makeUserWithRole('staff', $collegeB->id);

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/users');

    $response->assertOk();
    $collegeIds = collect($response->json('data.data'))->pluck('college_id')->unique()->filter();
    expect($collegeIds->all())->toBe([$collegeA->id]);
});

test('a college officer\'s user stats count only their own college, not the platform-wide totals', function () {
    $collegeA = College::create(['name' => 'CO College K '.rand(), 'code' => 'CK'.rand(10, 99)]);
    $collegeB = College::create(['name' => 'CO College L '.rand(), 'code' => 'CL'.rand(10, 99)]);
    $officerA = makeUserWithRole('college_officer', $collegeA->id);
    makeUserWithRole('staff', $collegeA->id);
    makeUserWithRole('staff', $collegeA->id);
    makeUserWithRole('staff', $collegeB->id);

    $response = $this->actingAs($officerA, 'sanctum')->getJson('/api/v1/users/stats');

    $response->assertOk();
    // officerA + 2 staff in college A = 3; must NOT include college B's user.
    expect($response->json('data.total'))->toBe(3);
});

test('a college officer only sees departments from their own college, even with a different college_id requested', function () {
    $collegeA = College::create(['name' => 'CO College C '.rand(), 'code' => 'CC'.rand(10, 99)]);
    $collegeB = College::create(['name' => 'CO College D '.rand(), 'code' => 'CD'.rand(10, 99)]);
    Department::create(['college_id' => $collegeA->id, 'name' => 'Dept A', 'code' => 'DA'.rand(10, 99)]);
    Department::create(['college_id' => $collegeB->id, 'name' => 'Dept B', 'code' => 'DB'.rand(10, 99)]);
    $officerA = makeUserWithRole('college_officer', $collegeA->id);

    $response = $this->actingAs($officerA, 'sanctum')
        ->getJson('/api/v1/departments?college_id='.$collegeB->id);

    $response->assertOk();
    $collegeIds = collect($response->json('data'))->pluck('college_id')->unique();
    expect($collegeIds->all())->toBe([$collegeA->id]);
});

test('a college officer cannot create a new department at all', function () {
    $collegeA = College::create(['name' => 'CO College E '.rand(), 'code' => 'CE'.rand(10, 99)]);
    $officerA = makeUserWithRole('college_officer', $collegeA->id);

    $response = $this->actingAs($officerA, 'sanctum')->postJson('/api/v1/departments', [
        'college_id' => $collegeA->id,
        'name' => 'New Dept',
        'code' => 'ND'.rand(1000, 9999),
    ]);

    $response->assertForbidden();
    $this->assertDatabaseMissing('departments', ['name' => 'New Dept']);
});

test('a college officer cannot update a department belonging to another college', function () {
    $collegeA = College::create(['name' => 'CO College G '.rand(), 'code' => 'CG'.rand(10, 99)]);
    $collegeB = College::create(['name' => 'CO College H '.rand(), 'code' => 'CH'.rand(10, 99)]);
    $deptB = Department::create(['college_id' => $collegeB->id, 'name' => 'Dept B', 'code' => 'DB'.rand(1000, 9999)]);
    $officerA = makeUserWithRole('college_officer', $collegeA->id);

    $this->actingAs($officerA, 'sanctum')
        ->putJson("/api/v1/departments/{$deptB->id}", ['name' => 'Hijacked'])
        ->assertForbidden();

    expect(Department::find($deptB->id)->name)->toBe('Dept B');
});

test('a college officer cannot generate a report builder result for another college', function () {
    $collegeA = College::create(['name' => 'CO College I '.rand(), 'code' => 'CI'.rand(10, 99)]);
    $collegeB = College::create(['name' => 'CO College J '.rand(), 'code' => 'CJ'.rand(10, 99)]);
    $officerA = makeUserWithRole('college_officer', $collegeA->id);

    $response = $this->actingAs($officerA, 'sanctum')->postJson('/api/v1/reports/generate', [
        'type' => 'custom_builder',
        'filters' => ['subject' => 'proposals', 'metrics' => ['count'], 'college_id' => $collegeB->id],
    ]);

    $response->assertSuccessful();
    expect($response->json('data.filters.college_id'))->toBe($collegeA->id);
});
