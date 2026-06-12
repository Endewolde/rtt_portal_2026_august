<?php

use App\Models\College;
use App\Models\Department;
use App\Models\NotificationPreference;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
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

function rh_makeBase(): array
{
    $college = College::create(['name' => 'RO College '.rand(), 'code' => 'RO'.rand(10, 99)]);
    $dept    = Department::create(['college_id' => $college->id, 'name' => 'Dept', 'code' => 'RD'.rand(10, 99)]);

    // Give the college a professional subscription so non-admin users pass feature:monitoring
    $plan = SubscriptionPlan::firstOrCreate(
        ['slug' => 'professional'],
        ['name' => 'Professional', 'description' => 'Pro', 'features' => ['proposals', 'finance', 'evaluation', 'monitoring', 'complaints', 'repository'], 'price' => 0, 'billing_period' => 'annual', 'is_active' => true]
    );
    Subscription::factory()->create(['college_id' => $college->id, 'subscription_plan_id' => $plan->id]);

    $admin = User::factory()->create(); $admin->assignRole('super_admin');
    $pi    = User::factory()->create(['college_id' => $college->id, 'department_id' => $dept->id]); $pi->assignRole('staff');

    foreach ([$admin, $pi] as $u) {
        NotificationPreference::firstOrCreate(['user_id' => $u->id], [
            'email_enabled' => true, 'telegram_enabled' => false, 'inapp_enabled' => true,
        ]);
    }

    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research',
        'title' => 'RO Call', 'slug' => 'ro-call-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $admin->id,
    ]);

    $proposal = Proposal::create([
        'tracker_number'   => 'TRK-'.rand(100000, 999999),
        'proposal_call_id' => $call->id,
        'category'         => 'research',
        'title'            => 'RO Test Proposal',
        'status'           => 'funded',
        'pi_user_id'       => $pi->id,
        'college_id'       => $college->id,
        'department_id'    => $dept->id,
        'academic_year'    => '2026',
        'created_by'       => $pi->id,
    ]);

    return [$proposal, $pi, $admin, $college];
}

// ─── GET /research-outputs ────────────────────────────────────────────────────

test('admin can list research outputs', function () {
    [$proposal, $pi, $admin] = rh_makeBase();

    ResearchOutput::create([
        'proposal_id' => $proposal->id,
        'output_type' => 'journal_article',
        'title'       => 'A Test Article',
        'recorded_by' => $admin->id,
    ]);

    $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/research-outputs');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('data.0.title'))->toBe('A Test Article');
});

test('PI can only see their own proposal outputs', function () {
    [$proposal, $pi, $admin] = rh_makeBase();
    [$proposal2, $pi2]       = rh_makeBase();

    ResearchOutput::create([
        'proposal_id' => $proposal->id,
        'output_type' => 'patent',
        'title'       => 'PI Patent',
        'recorded_by' => $pi->id,
    ]);
    ResearchOutput::create([
        'proposal_id' => $proposal2->id,
        'output_type' => 'patent',
        'title'       => 'Other Patent',
        'recorded_by' => $pi2->id,
    ]);

    $response = $this->actingAs($pi, 'sanctum')->getJson('/api/v1/research-outputs');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('data.0.title'))->toBe('PI Patent');
});

test('unauthenticated user cannot list research outputs', function () {
    $this->getJson('/api/v1/research-outputs')->assertUnauthorized();
});

// ─── POST /research-outputs ───────────────────────────────────────────────────

test('admin can create a journal article output', function () {
    [$proposal, $pi, $admin] = rh_makeBase();

    $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/research-outputs', [
        'proposal_id'  => $proposal->id,
        'output_type'  => 'journal_article',
        'title'        => 'Advanced Research in Testing',
        'journal_name' => 'Test Journal of Science',
        'year'         => 2024,
        'doi'          => '10.1234/test.2024',
        'is_scopus_indexed' => true,
        'is_wos_indexed'    => false,
    ]);

    $response->assertCreated();
    expect($response->json('data.title'))->toBe('Advanced Research in Testing');
    expect($response->json('data.publication.journal_name'))->toBe('Test Journal of Science');
    expect($response->json('data.publication.is_scopus_indexed'))->toBeTrue();
    $this->assertDatabaseHas('research_outputs', ['title' => 'Advanced Research in Testing', 'output_type' => 'journal_article']);
    $this->assertDatabaseHas('publications', ['journal_name' => 'Test Journal of Science']);
});

test('admin can create a patent output', function () {
    [$proposal, $pi, $admin] = rh_makeBase();

    $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/research-outputs', [
        'proposal_id'   => $proposal->id,
        'output_type'   => 'patent',
        'title'         => 'Innovation Patent',
        'patent_number' => 'ETH-2024-001',
        'jurisdiction'  => 'Ethiopia',
        'patent_status' => 'granted',
    ]);

    $response->assertCreated();
    $this->assertDatabaseHas('patents', ['patent_number' => 'ETH-2024-001', 'jurisdiction' => 'Ethiopia']);
});

test('PI can create an output for their own funded proposal', function () {
    [$proposal, $pi, $admin] = rh_makeBase();

    $response = $this->actingAs($pi, 'sanctum')->postJson('/api/v1/research-outputs', [
        'proposal_id' => $proposal->id,
        'output_type' => 'community_impact',
        'title'       => 'Community Workshop Impact',
        'beneficiary_count' => 150,
        'impact_category'   => 'Health',
    ]);

    $response->assertCreated();
    $this->assertDatabaseHas('community_impacts', ['beneficiary_count' => 150]);
});

test('PI cannot create output for another proposal', function () {
    [$proposal, $pi, $admin] = rh_makeBase();
    [$proposal2]             = rh_makeBase();

    $this->actingAs($pi, 'sanctum')->postJson('/api/v1/research-outputs', [
        'proposal_id' => $proposal2->id,
        'output_type' => 'journal_article',
        'title'       => 'Unauthorized Output',
    ])->assertForbidden();
});

test('creating an output updates repository record counts', function () {
    [$proposal, $pi, $admin, $college] = rh_makeBase();

    $record = RepositoryRecord::create([
        'proposal_id'  => $proposal->id,
        'title'        => $proposal->title,
        'category'     => 'research',
        'college_id'   => $college->id,
        'pi_name'      => $pi->name,
        'academic_year'=> '2026',
        'status'       => 'published',
    ]);

    $this->actingAs($admin, 'sanctum')->postJson('/api/v1/research-outputs', [
        'proposal_id' => $proposal->id,
        'output_type' => 'journal_article',
        'title'       => 'Sync Test Article',
    ])->assertCreated();

    $record->refresh();
    expect($record->total_outputs)->toBe(1);
    expect($record->publications_count)->toBe(1);
});

// ─── DELETE /research-outputs/{id} ───────────────────────────────────────────

test('admin can delete a research output', function () {
    [$proposal, $pi, $admin] = rh_makeBase();

    $output = ResearchOutput::create([
        'proposal_id' => $proposal->id,
        'output_type' => 'book',
        'title'       => 'To Be Deleted',
        'recorded_by' => $admin->id,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/research-outputs/{$output->id}")
        ->assertOk();

    $this->assertDatabaseMissing('research_outputs', ['id' => $output->id]);
});

test('PI cannot delete an output on another proposal', function () {
    [$proposal, $pi]   = rh_makeBase();
    [$proposal2, $pi2] = rh_makeBase();

    $output = ResearchOutput::create([
        'proposal_id' => $proposal2->id,
        'output_type' => 'book',
        'title'       => 'Other proposals output',
        'recorded_by' => $pi2->id,
    ]);

    $this->actingAs($pi, 'sanctum')
        ->deleteJson("/api/v1/research-outputs/{$output->id}")
        ->assertForbidden();
});

// ─── GET /admin/repository ────────────────────────────────────────────────────

test('admin can list repository records', function () {
    [$proposal, $pi, $admin, $college] = rh_makeBase();

    RepositoryRecord::create([
        'proposal_id'  => $proposal->id,
        'title'        => 'Published Research',
        'category'     => 'research',
        'college_id'   => $college->id,
        'pi_name'      => $pi->name,
        'academic_year'=> '2026',
        'status'       => 'published',
    ]);

    $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/repository');

    $response->assertOk();
    expect($response->json('data.data'))->toHaveCount(1);
});

test('non-admin cannot access admin repository endpoints', function () {
    [, $pi] = rh_makeBase();

    $this->actingAs($pi, 'sanctum')
        ->getJson('/api/v1/admin/repository')
        ->assertForbidden();
});

// ─── POST /admin/repository/{proposalId}/publish ──────────────────────────────

test('admin can publish a completed proposal to the repository', function () {
    [$proposal, $pi, $admin, $college] = rh_makeBase();

    $proposal->update(['status' => 'completed']);
    $pi->update(['name' => 'Dr. Test PI']);

    $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/repository/{$proposal->id}/publish", [
        'keywords'   => 'testing, repository, research',
        'is_featured'=> false,
    ]);

    $response->assertCreated();
    $this->assertDatabaseHas('repository_records', [
        'proposal_id' => $proposal->id,
        'status'      => 'published',
        'keywords'    => 'testing, repository, research',
    ]);
});

test('publishing an already-published proposal updates the record', function () {
    [$proposal, $pi, $admin, $college] = rh_makeBase();

    $proposal->update(['status' => 'completed']);

    $existing = RepositoryRecord::create([
        'proposal_id'  => $proposal->id,
        'title'        => 'Old Title',
        'category'     => 'research',
        'college_id'   => $college->id,
        'pi_name'      => $pi->name,
        'academic_year'=> '2026',
        'status'       => 'archived',
    ]);

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/admin/repository/{$proposal->id}/publish", ['is_featured' => true])
        ->assertCreated();

    $existing->refresh();
    expect($existing->status)->toBe('published');
    expect($existing->is_featured)->toBeTrue();
});

// ─── DELETE /admin/repository/{id} — unpublish ───────────────────────────────

test('admin can unpublish a repository record', function () {
    [$proposal, $pi, $admin, $college] = rh_makeBase();

    $record = RepositoryRecord::create([
        'proposal_id'  => $proposal->id,
        'title'        => 'Published Research',
        'category'     => 'research',
        'college_id'   => $college->id,
        'pi_name'      => $pi->name,
        'academic_year'=> '2026',
        'status'       => 'published',
    ]);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/admin/repository/{$record->id}")
        ->assertOk();

    $record->refresh();
    expect($record->status)->toBe('archived');
});
