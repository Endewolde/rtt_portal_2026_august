<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use App\Services\WorkflowService;
use App\Support\Access\PermissionCatalog;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\WorkflowStageSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    (new WorkflowStageSeeder)->run();

    $this->superAdmin = User::factory()->create();
    $this->superAdmin->assignRole('super_admin');

    $this->college = College::create(['name' => 'Own '.rand(), 'code' => 'CR'.rand(10000, 99999)]);
    $this->otherCollege = College::create(['name' => 'Other '.rand(), 'code' => 'CO'.rand(10000, 99999)]);

    $this->call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'cr-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $this->superAdmin->id,
    ]);

    $this->makeProposal = function (College $college, string $status = 'submitted', string $category = 'research'): Proposal {
        $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'CD'.rand(100000, 999999)]);
        $pi = User::factory()->create(['college_id' => $college->id]);
        $pi->assignRole('staff');

        return Proposal::create([
            'tracker_number' => 'CR-'.rand(100000, 999999), 'proposal_call_id' => $this->call->id, 'category' => $category,
            'title' => 'P', 'status' => $status, 'pi_user_id' => $pi->id, 'college_id' => $college->id,
            'department_id' => $dept->id, 'academic_year' => '2026', 'created_by' => $pi->id,
        ]);
    };

    /** Create a custom role through the Roles API and give a new user that role. */
    $this->customRoleUser = function (array $permissions, string $scope, ?string $category = null, ?College $college = null): User {
        $role = $this->actingAs($this->superAdmin, 'sanctum')->postJson('/api/v1/roles', [
            'label' => 'Custom '.rand(1000, 9999),
            'scope' => $scope,
            'scope_category' => $category,
            'permissions' => $permissions,
        ])->assertCreated()->json('data');

        $user = User::factory()->create(['college_id' => $college?->id]);
        $user->assignRole($role['name']);

        return $user->fresh();
    };
});

test('the catalogue lists grouped permissions, scopes and categories for role managers only', function () {
    $response = $this->actingAs($this->superAdmin, 'sanctum')->getJson('/api/v1/permissions/catalog')->assertOk();

    $names = collect($response->json('data.groups'))->flatMap(fn ($g) => collect($g['permissions'])->pluck('name'));
    expect($names)->toContain('proposals.view_any', 'evaluation.central', 'roles.manage')
        ->and(collect($response->json('data.scopes'))->pluck('value')->all())->toBe(['all', 'college', 'college_if_set', 'category', 'own']);

    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $this->actingAs($admin, 'sanctum')->getJson('/api/v1/permissions/catalog')->assertForbidden();
});

test('every catalogued permission exists after the seeder and super admin holds them all', function () {
    $missing = array_diff(array_keys(PermissionCatalog::all()), Permission::pluck('name')->all());
    expect($missing)->toBe([]);

    $superAdmin = Role::findByName('super_admin', 'web');
    expect($superAdmin->permissions()->count())->toBe(Permission::count());
});

test('a role is created with a label, scope and permissions, and its system name is derived from the label', function () {
    $this->actingAs($this->superAdmin, 'sanctum')->postJson('/api/v1/roles', [
        'label' => 'Data Analyst',
        'description' => 'Reads reports.',
        'scope' => 'category',
        'scope_category' => 'research',
        'permissions' => ['analytics.view', 'reports.view_any'],
    ])->assertCreated()->assertJsonPath('data.name', 'data_analyst');

    $role = Role::findByName('data_analyst', 'web');
    expect($role->label)->toBe('Data Analyst')
        ->and($role->scope)->toBe('category')
        ->and($role->scope_category)->toBe('research')
        ->and($role->permissions->pluck('name')->sort()->values()->all())->toBe(['analytics.view', 'reports.view_any']);
});

test('a category scope needs a category', function () {
    $this->actingAs($this->superAdmin, 'sanctum')->postJson('/api/v1/roles', [
        'label' => 'No Category', 'scope' => 'category',
    ])->assertUnprocessable()->assertJsonValidationErrors('scope_category');
});

test('copying a role copies its permissions', function () {
    $source = Role::findByName('college_officer', 'web');

    $this->actingAs($this->superAdmin, 'sanctum')->postJson('/api/v1/roles', [
        'label' => 'College Officer Copy', 'scope' => 'college', 'clone_from' => $source->id,
    ])->assertCreated();

    expect(Role::findByName('college_officer_copy', 'web')->permissions->pluck('name')->sort()->values()->all())
        ->toBe($source->permissions->pluck('name')->sort()->values()->all());
});

test('only role managers can create, edit or delete roles', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')->postJson('/api/v1/roles', ['label' => 'Nope', 'scope' => 'own'])->assertForbidden();
    $this->actingAs($admin, 'sanctum')->putJson('/api/v1/roles/'.Role::findByName('staff', 'web')->id.'/permissions', ['permissions' => []])->assertForbidden();
});

test('built-in roles can be edited but not deleted, and super admin keeps every permission', function () {
    $staff = Role::findByName('staff', 'web');
    $this->actingAs($this->superAdmin, 'sanctum')->putJson("/api/v1/roles/{$staff->id}", [
        'label' => 'Researcher', 'scope' => 'own',
    ])->assertOk();
    expect($staff->fresh()->label)->toBe('Researcher');

    $this->actingAs($this->superAdmin, 'sanctum')->deleteJson("/api/v1/roles/{$staff->id}")->assertUnprocessable();

    $super = Role::findByName('super_admin', 'web');
    $this->actingAs($this->superAdmin, 'sanctum')->putJson("/api/v1/roles/{$super->id}/permissions", ['permissions' => []])->assertUnprocessable();
    $this->actingAs($this->superAdmin, 'sanctum')->putJson("/api/v1/roles/{$super->id}", ['label' => 'Owner', 'scope' => 'own'])->assertOk();
    expect($super->fresh()->scope)->toBe('all');
});

test('a role\'s permissions can be cleared', function () {
    $role = Role::create(['name' => 'temp_role', 'guard_name' => 'web']);
    $role->givePermissionTo('analytics.view');

    $this->actingAs($this->superAdmin, 'sanctum')->putJson("/api/v1/roles/{$role->id}/permissions", ['permissions' => []])->assertOk();

    expect($role->fresh()->permissions)->toHaveCount(0);
});

test('refreshing restores missing catalogue permissions without undoing edits made on the Roles page', function () {
    $admin = Role::findByName('admin', 'web');
    $admin->revokePermissionTo('analytics.view');
    Permission::findByName('pipeline.view', 'web')->delete();
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->actingAs($this->superAdmin, 'sanctum')->postJson('/api/v1/permissions/refresh')
        ->assertOk()
        ->assertJsonPath('data.created', ['pipeline.view']);

    app(PermissionRegistrar::class)->forgetCachedPermissions();
    expect(Permission::where('name', 'pipeline.view')->exists())->toBeTrue()
        ->and($admin->fresh()->hasPermissionTo('analytics.view'))->toBeFalse()
        ->and(Role::findByName('super_admin', 'web')->hasPermissionTo('pipeline.view'))->toBeTrue();
});

test('a college-scoped custom role sees its own college\'s proposals in every category, and nothing else', function () {
    $research = ($this->makeProposal)($this->college, 'submitted', 'research');
    $community = ($this->makeProposal)($this->college, 'funded', 'community_engagement');
    ($this->makeProposal)($this->otherCollege);

    $user = ($this->customRoleUser)(['proposals.view_any', 'proposals.view'], 'college', null, $this->college);

    $ids = collect($this->actingAs($user, 'sanctum')->getJson('/api/v1/proposals?per_page=50')->assertOk()->json('data.data'))->pluck('id');
    expect($ids->sort()->values()->all())->toBe(collect([$research->id, $community->id])->sort()->values()->all());
});

test('a category-scoped custom role sees its category across all colleges, and nothing else', function () {
    $own = ($this->makeProposal)($this->college, 'submitted', 'technology_transfer');
    $other = ($this->makeProposal)($this->otherCollege, 'submitted', 'technology_transfer');
    ($this->makeProposal)($this->college, 'submitted', 'research');

    $user = ($this->customRoleUser)(['proposals.view_any', 'proposals.view'], 'category', 'technology_transfer');

    $ids = collect($this->actingAs($user, 'sanctum')->getJson('/api/v1/proposals?per_page=50')->assertOk()->json('data.data'))->pluck('id');
    expect($ids->sort()->values()->all())->toBe(collect([$own->id, $other->id])->sort()->values()->all());
});

test('a custom role is denied what it was not given', function () {
    $user = ($this->customRoleUser)(['analytics.view'], 'all');

    $this->actingAs($user, 'sanctum')->getJson('/api/v1/proposals/validation-queue')->assertForbidden();
    $this->actingAs($user, 'sanctum')->postJson('/api/v1/roles', ['label' => 'X', 'scope' => 'own'])->assertForbidden();
});

test('a custom role takes workflow steps through its permissions, only within its scope', function () {
    $own = ($this->makeProposal)($this->college, 'submitted');
    $other = ($this->makeProposal)($this->otherCollege, 'submitted');

    $validator = ($this->customRoleUser)(['proposals.validate'], 'college', null, $this->college);
    $bystander = ($this->customRoleUser)(['proposals.view_any'], 'college', null, $this->college);
    $workflow = app(WorkflowService::class);

    expect($workflow->canTransition($own, 'validate', $validator))->toBeTrue()
        ->and($workflow->canTransition($other, 'validate', $validator))->toBeFalse()
        ->and($workflow->canTransition($own, 'validate', $bystander))->toBeFalse();
});

test('editing a role\'s scope changes what its holders see', function () {
    ($this->makeProposal)($this->college);
    ($this->makeProposal)($this->otherCollege);

    $user = ($this->customRoleUser)(['proposals.view_any', 'proposals.view'], 'college', null, $this->college);
    $role = Role::findByName($user->getRoleNames()->first(), 'web');

    expect($this->actingAs($user, 'sanctum')->getJson('/api/v1/proposals?per_page=50')->json('data.data'))->toHaveCount(1);

    $this->actingAs($this->superAdmin, 'sanctum')->putJson("/api/v1/roles/{$role->id}", ['label' => $role->label, 'scope' => 'all'])->assertOk();

    expect($this->actingAs($user->fresh(), 'sanctum')->getJson('/api/v1/proposals?per_page=50')->json('data.data'))->toHaveCount(2);
});

test('the signed-in user payload carries the data scope', function () {
    $user = ($this->customRoleUser)(['proposals.view_any'], 'category', 'research');

    $this->actingAs($user, 'sanctum')->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.user.access_scope.type', 'category');
});

test('switching features on or off needs features.manage', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin, 'sanctum')->postJson('/api/v1/features/toggle', ['slug' => 'complaints', 'enabled' => false])->assertForbidden();
    $this->actingAs($admin, 'sanctum')->putJson('/api/v1/features/sub', ['disabled' => []])->assertForbidden();
});

test('similarity scores need similarity.view', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $this->actingAs($staff, 'sanctum')->getJson('/api/v1/similarity-scores')->assertForbidden();
});

test('built-in role metadata matches the catalogue after seeding', function () {
    $row = DB::table('roles')->where('name', 'research_officer')->first();

    expect($row->label)->toBe('Research Director')
        ->and($row->scope)->toBe('category')
        ->and($row->scope_category)->toBe('research');
});
