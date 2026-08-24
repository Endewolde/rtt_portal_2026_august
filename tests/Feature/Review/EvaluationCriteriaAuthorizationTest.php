<?php

use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('a non-admin cannot create, update, or delete evaluation types/categories/questions', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');

    $type = EvaluationType::create(['name' => 'eca_type_'.Str::random(6), 'label' => 'T', 'proposal_category' => 'research', 'is_active' => true]);
    $category = EvaluationCategory::create(['evaluation_type_id' => $type->id, 'name' => 'C', 'order_index' => 1, 'weight' => 100]);
    $question = EvaluationQuestion::create(['evaluation_category_id' => $category->id, 'question_text' => 'Q', 'max_score' => 5, 'weight' => 1, 'is_required' => true, 'order_index' => 1]);

    $this->actingAs($staff)->postJson('/api/v1/evaluation-types', [
        'name' => 'blocked_type', 'label' => 'Blocked', 'proposal_category' => 'research',
    ])->assertForbidden();

    $this->actingAs($staff)->putJson("/api/v1/evaluation-types/{$type->id}", ['label' => 'Hacked'])->assertForbidden();

    $this->actingAs($staff)->postJson("/api/v1/evaluation-types/{$type->id}/categories", [
        'name' => 'Blocked Category', 'weight' => 10,
    ])->assertForbidden();
    $this->actingAs($staff)->putJson("/api/v1/evaluation-categories/{$category->id}", ['weight' => 999])->assertForbidden();
    $this->actingAs($staff)->deleteJson("/api/v1/evaluation-categories/{$category->id}")->assertForbidden();

    $this->actingAs($staff)->postJson("/api/v1/evaluation-categories/{$category->id}/questions", [
        'question_text' => 'Blocked Q', 'max_score' => 5,
    ])->assertForbidden();
    $this->actingAs($staff)->putJson("/api/v1/evaluation-questions/{$question->id}", ['max_score' => 1])->assertForbidden();
    $this->actingAs($staff)->deleteJson("/api/v1/evaluation-questions/{$question->id}")->assertForbidden();

    expect($type->fresh()->label)->toBe('T')
        ->and($category->fresh()->weight)->toEqual(100)
        ->and($question->fresh()->max_score)->toBe(5)
        ->and(EvaluationCategory::find($category->id))->not->toBeNull()
        ->and(EvaluationQuestion::find($question->id))->not->toBeNull();
});

test('central_officer can manage evaluation criteria', function () {
    $central = User::factory()->create();
    $central->assignRole('central_officer');

    $response = $this->actingAs($central)->postJson('/api/v1/evaluation-types', [
        'name' => 'eca_allowed_'.Str::random(6), 'label' => 'Allowed', 'proposal_category' => 'research',
    ]);

    $response->assertOk();
    expect($response->json('data.label'))->toBe('Allowed');
});
