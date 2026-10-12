<?php

use App\Models\ProposalTemplate;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

function pt_pi(): User
{
    $pi = User::factory()->create();
    $pi->assignRole('staff');

    return $pi;
}

// ─── store() ─────────────────────────────────────────────────────────────────

test('a PI can save a proposal template', function () {
    $pi = pt_pi();

    $response = $this->actingAs($pi, 'sanctum')
        ->postJson('/api/v1/proposal-templates', [
            'name' => 'My Standard Research Template',
            'category' => 'research',
            'title' => 'Reusable title',
            'abstract' => 'Reusable abstract content.',
            'focus_area' => 'Agriculture',
            'duration_months' => 12,
            'research_type' => 'applied',
            'budget_items' => [
                ['category' => 'personnel', 'description' => 'RA stipend', 'amount' => 1000, 'justification' => 'For fieldwork'],
            ],
        ]);

    $response->assertStatus(201)->assertJsonPath('data.name', 'My Standard Research Template');
    expect(ProposalTemplate::where('user_id', $pi->id)->count())->toBe(1);

    $template = ProposalTemplate::first();
    expect($template->template_data['title'])->toBe('Reusable title')
        ->and($template->template_data['budget_items'])->toHaveCount(1);
});

test('saving a template requires a name and a valid category', function () {
    $pi = pt_pi();

    $this->actingAs($pi, 'sanctum')
        ->postJson('/api/v1/proposal-templates', ['category' => 'research'])
        ->assertStatus(422);

    $this->actingAs($pi, 'sanctum')
        ->postJson('/api/v1/proposal-templates', ['name' => 'Test', 'category' => 'not-a-category'])
        ->assertStatus(422);
});

test('a PI cannot exceed the maximum number of saved templates', function () {
    $pi = pt_pi();
    for ($i = 0; $i < 20; $i++) {
        ProposalTemplate::create([
            'user_id' => $pi->id,
            'category' => 'research',
            'name' => "Template {$i}",
            'template_data' => ['title' => '', 'abstract' => '', 'keywords' => '', 'focus_area' => '', 'duration_months' => null, 'research_type' => '', 'budget_items' => []],
        ]);
    }

    $this->actingAs($pi, 'sanctum')
        ->postJson('/api/v1/proposal-templates', ['name' => 'One too many', 'category' => 'research'])
        ->assertStatus(422);
});

// ─── index() ─────────────────────────────────────────────────────────────────

test('a PI only sees their own templates', function () {
    $pi = pt_pi();
    $other = pt_pi();

    ProposalTemplate::create([
        'user_id' => $pi->id, 'category' => 'research', 'name' => 'Mine',
        'template_data' => ['title' => '', 'abstract' => '', 'keywords' => '', 'focus_area' => '', 'duration_months' => null, 'research_type' => '', 'budget_items' => []],
    ]);
    ProposalTemplate::create([
        'user_id' => $other->id, 'category' => 'research', 'name' => 'Not mine',
        'template_data' => ['title' => '', 'abstract' => '', 'keywords' => '', 'focus_area' => '', 'duration_months' => null, 'research_type' => '', 'budget_items' => []],
    ]);

    $response = $this->actingAs($pi, 'sanctum')->getJson('/api/v1/proposal-templates')->assertOk();
    $names = collect($response->json('data'))->pluck('name');

    expect($names)->toContain('Mine')->not->toContain('Not mine');
});

test('templates can be filtered by category', function () {
    $pi = pt_pi();
    ProposalTemplate::create([
        'user_id' => $pi->id, 'category' => 'research', 'name' => 'Research One',
        'template_data' => ['title' => '', 'abstract' => '', 'keywords' => '', 'focus_area' => '', 'duration_months' => null, 'research_type' => '', 'budget_items' => []],
    ]);
    ProposalTemplate::create([
        'user_id' => $pi->id, 'category' => 'community_engagement', 'name' => 'Community One',
        'template_data' => ['title' => '', 'abstract' => '', 'keywords' => '', 'focus_area' => '', 'duration_months' => null, 'research_type' => '', 'budget_items' => []],
    ]);

    $response = $this->actingAs($pi, 'sanctum')->getJson('/api/v1/proposal-templates?category=research')->assertOk();
    $names = collect($response->json('data'))->pluck('name');

    expect($names)->toContain('Research One')->not->toContain('Community One');
});

// ─── destroy() ───────────────────────────────────────────────────────────────

test('a PI can delete their own template', function () {
    $pi = pt_pi();
    $template = ProposalTemplate::create([
        'user_id' => $pi->id, 'category' => 'research', 'name' => 'Delete me',
        'template_data' => ['title' => '', 'abstract' => '', 'keywords' => '', 'focus_area' => '', 'duration_months' => null, 'research_type' => '', 'budget_items' => []],
    ]);

    $this->actingAs($pi, 'sanctum')
        ->deleteJson("/api/v1/proposal-templates/{$template->id}")
        ->assertOk();

    expect(ProposalTemplate::find($template->id))->toBeNull();
});

test('a PI cannot delete another PI\'s template', function () {
    $pi = pt_pi();
    $other = pt_pi();
    $template = ProposalTemplate::create([
        'user_id' => $other->id, 'category' => 'research', 'name' => 'Not yours',
        'template_data' => ['title' => '', 'abstract' => '', 'keywords' => '', 'focus_area' => '', 'duration_months' => null, 'research_type' => '', 'budget_items' => []],
    ]);

    $this->actingAs($pi, 'sanctum')
        ->deleteJson("/api/v1/proposal-templates/{$template->id}")
        ->assertStatus(403);

    expect(ProposalTemplate::find($template->id))->not->toBeNull();
});
