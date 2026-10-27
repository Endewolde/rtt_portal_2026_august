<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ProposalMessage;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    Storage::fake('private');
    $this->college = College::create(['name' => 'Msg College', 'code' => 'MC'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $this->college->id, 'name' => 'D', 'code' => 'MD'.rand(10000, 99999)]);
    $this->central = User::factory()->create();
    $this->central->assignRole('central_officer');
    $call = ProposalCall::create([
        'academic_year' => '2026-2027', 'category' => 'research', 'title' => 'Call', 'slug' => 'mc-'.rand(10000, 99999),
        'start_date' => now(), 'end_date' => now()->addMonth(), 'status' => 'active', 'is_open' => true, 'created_by' => $this->central->id,
    ]);
    $this->pi = User::factory()->create(['status' => 'active']);
    $this->pi->assignRole('pi');
    $this->officer = User::factory()->create(['college_id' => $this->college->id, 'status' => 'active']);
    $this->officer->assignRole('college_officer');
    $this->proposal = Proposal::create([
        'tracker_number' => 'MSG-1', 'proposal_call_id' => $call->id, 'category' => 'research', 'title' => 'Messages',
        'status' => 'validated', 'pi_user_id' => $this->pi->id, 'college_id' => $this->college->id, 'department_id' => $dept->id,
        'academic_year' => '2026-2027', 'created_by' => $this->pi->id,
    ]);
});

test('the PI writes to the office with an attachment, and the college officer is notified', function () {
    $this->actingAs($this->pi, 'sanctum')->post("/api/v1/proposals/{$this->proposal->id}/messages", [
        'body' => 'We attached the corrected budget.',
        'attachment' => UploadedFile::fake()->create('budget.pdf', 50, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.from_team', true);

    $message = ProposalMessage::first();
    Storage::disk('private')->assertExists($message->attachment_path);
    expect(DB::table('notifications')->where('notifiable_id', $this->officer->id)->where('type', 'proposal_message')->exists())->toBeTrue();
});

test('staff replies reach the team, unread counts go up and reading clears them', function () {
    $this->actingAs($this->officer, 'sanctum')->postJson("/api/v1/proposals/{$this->proposal->id}/messages", ['body' => 'Please clarify objective 2.'])->assertCreated();

    expect(DB::table('notifications')->where('notifiable_id', $this->pi->id)->where('type', 'proposal_message')->exists())->toBeTrue();
    $this->actingAs($this->pi, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/messages/unread")->assertJsonPath('data.count', 1);

    $this->getJson("/api/v1/proposals/{$this->proposal->id}/messages")->assertOk()
        ->assertJsonPath('data.0.body', 'Please clarify objective 2.')
        ->assertJsonPath('data.0.from_team', false);
    $this->getJson("/api/v1/proposals/{$this->proposal->id}/messages/unread")->assertJsonPath('data.count', 0);
});

test('people outside the team and the proposal’s scope cannot read the thread or its files', function () {
    $this->actingAs($this->pi, 'sanctum')->post("/api/v1/proposals/{$this->proposal->id}/messages", [
        'body' => 'Private.', 'attachment' => UploadedFile::fake()->create('note.pdf', 10, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated();
    $message = ProposalMessage::first();

    $reviewer = User::factory()->create();
    $reviewer->assignRole('staff');
    $otherCollege = College::create(['name' => 'Elsewhere', 'code' => 'EL'.rand(10000, 99999)]);
    $outsider = User::factory()->create(['college_id' => $otherCollege->id]);
    $outsider->assignRole('college_officer');

    foreach ([$reviewer, $outsider] as $user) {
        $this->actingAs($user, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/messages")->assertForbidden();
        $this->actingAs($user, 'sanctum')->getJson("/api/v1/proposal-messages/{$message->id}/attachment")->assertForbidden();
        $this->actingAs($user, 'sanctum')->getJson("/api/v1/proposals/{$this->proposal->id}/messages/unread")->assertJsonPath('data.can_see', false);
    }

    $this->actingAs($this->central, 'sanctum')->get("/api/v1/proposal-messages/{$message->id}/attachment")->assertOk();
});
