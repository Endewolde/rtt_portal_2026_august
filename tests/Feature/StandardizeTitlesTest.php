<?php

use App\Models\College;
use App\Models\Department;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    (new RolePermissionSeeder)->run();
    $creator = User::factory()->create();
    $college = College::create(['name' => 'C'.rand(), 'code' => 'TT'.rand(10000, 99999)]);
    $dept = Department::create(['college_id' => $college->id, 'name' => 'D', 'code' => 'TTD'.rand(10000, 99999)]);
    $call = ProposalCall::create([
        'academic_year' => '2026', 'category' => 'research', 'title' => 'Call', 'slug' => 'tt-'.rand(10000, 99999),
        'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
        'status' => 'active', 'is_open' => true, 'created_by' => $creator->id,
    ]);
    $this->base = [
        'proposal_call_id' => $call->id, 'category' => 'research', 'status' => 'submitted',
        'pi_user_id' => $creator->id, 'college_id' => $college->id, 'department_id' => $dept->id,
        'academic_year' => '2026', 'created_by' => $creator->id,
    ];
});

test('titles are stored and returned in the standard form', function () {
    $proposal = Proposal::create($this->base + ['tracker_number' => 'TT-1', 'title' => 'EFFECT OF ICT ON RURAL FARMERS']);

    expect(DB::table('proposals')->where('id', $proposal->id)->value('title'))->toBe('Effect of ICT on Rural Farmers')
        ->and($proposal->fresh()->title)->toBe('Effect of ICT on Rural Farmers');
});

test('existing titles are shown in the standard form even before the backfill runs', function () {
    $proposal = Proposal::create($this->base + ['tracker_number' => 'TT-2', 'title' => 'x']);
    DB::table('proposals')->where('id', $proposal->id)->update(['title' => 'soil erosion in ETHIOPIA highlands']);

    expect($proposal->fresh()->title)->toBe('Soil Erosion in Ethiopia Highlands');
});

test('the backfill is a dry run by default and rewrites with --force, keeping the original in the audit log', function () {
    $proposal = Proposal::create($this->base + ['tracker_number' => 'TT-3', 'title' => 'x']);
    DB::table('proposals')->where('id', $proposal->id)->update(['title' => 'ASSESSMENT OF MATERNAL HEALTH']);

    Artisan::call('proposals:standardize-titles');
    expect(Artisan::output())->toContain('DRY RUN')
        ->and(DB::table('proposals')->where('id', $proposal->id)->value('title'))->toBe('ASSESSMENT OF MATERNAL HEALTH');

    Artisan::call('proposals:standardize-titles', ['--force' => true]);

    expect(DB::table('proposals')->where('id', $proposal->id)->value('title'))->toBe('Assessment of Maternal Health');
    $log = DB::table('audit_logs')->where('auditable_id', $proposal->id)->where('event', 'title.standardized')->first();
    expect(json_decode($log->old_values, true)['title'])->toBe('ASSESSMENT OF MATERNAL HEALTH');

    Artisan::call('proposals:standardize-titles');
    expect(Artisan::output())->toContain('nothing to do');
});
