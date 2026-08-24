<?php

use App\Models\Faq;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
});

test('public endpoint returns only active faqs', function () {
    Faq::create(['question' => 'Active Q?', 'answer' => 'Yes.', 'sort_order' => 0, 'is_active' => true]);
    Faq::create(['question' => 'Hidden Q?', 'answer' => 'No.', 'sort_order' => 1, 'is_active' => false]);

    $response = $this->getJson('/api/v1/faqs/public');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.question'))->toBe('Active Q?');
});

test('admin can list all faqs including inactive', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    Faq::create(['question' => 'Q1?', 'answer' => 'A1.', 'sort_order' => 0, 'is_active' => true]);
    Faq::create(['question' => 'Q2?', 'answer' => 'A2.', 'sort_order' => 1, 'is_active' => false]);

    $response = $this->actingAs($admin)->getJson('/api/v1/faqs');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

test('admin can create a faq', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    $response = $this->actingAs($admin)->postJson('/api/v1/faqs', [
        'question' => 'What is RTT?',
        'answer' => 'RTT is the Research Tracking and Transparency platform.',
        'sort_order' => 0,
        'is_active' => true,
    ]);

    $response->assertCreated();
    expect(Faq::where('question', 'What is RTT?')->exists())->toBeTrue();
});

test('admin can update a faq', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $faq = Faq::create(['question' => 'Old Q?', 'answer' => 'Old A.', 'sort_order' => 0, 'is_active' => true]);

    $response = $this->actingAs($admin)->putJson("/api/v1/faqs/{$faq->id}", [
        'question' => 'Updated Q?',
        'answer' => 'Updated A.',
        'sort_order' => 0,
        'is_active' => true,
    ]);

    $response->assertOk();
    expect($faq->fresh()->question)->toBe('Updated Q?');
});

test('admin can delete a faq', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $faq = Faq::create(['question' => 'To delete?', 'answer' => 'Yes.', 'sort_order' => 0, 'is_active' => true]);

    $response = $this->actingAs($admin)->deleteJson("/api/v1/faqs/{$faq->id}");

    $response->assertOk();
    expect(Faq::find($faq->id))->toBeNull();
});

test('unauthenticated user cannot access admin faq endpoints', function () {
    $this->getJson('/api/v1/faqs')->assertUnauthorized();
    $this->postJson('/api/v1/faqs', [])->assertUnauthorized();
});

test('a non-admin authenticated user cannot manage faqs', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $faq = Faq::create(['question' => 'Q?', 'answer' => 'A.', 'sort_order' => 0, 'is_active' => true]);

    $this->actingAs($staff)->getJson('/api/v1/faqs')->assertForbidden();
    $this->actingAs($staff)->postJson('/api/v1/faqs', [
        'question' => 'New?', 'answer' => 'New.', 'sort_order' => 0, 'is_active' => true,
    ])->assertForbidden();
    $this->actingAs($staff)->putJson("/api/v1/faqs/{$faq->id}", [
        'question' => 'Edited?', 'answer' => 'Edited.', 'sort_order' => 0, 'is_active' => true,
    ])->assertForbidden();
    $this->actingAs($staff)->deleteJson("/api/v1/faqs/{$faq->id}")->assertForbidden();
    $this->actingAs($staff)->putJson('/api/v1/faqs/reorder', ['ids' => [$faq->id]])->assertForbidden();

    expect(Faq::find($faq->id)->question)->toBe('Q?');
});
