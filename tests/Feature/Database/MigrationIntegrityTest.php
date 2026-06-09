<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    config(['database.connections.mysql.database' => 'real_rtt1']);
    DB::purge('mysql');
});

test('all_expected_tables_exist', function () {
    $expected = [
        'users', 'colleges', 'departments', 'workflow_stages', 'workflow_actions',
        'workflow_transitions', 'proposal_calls', 'proposals', 'proposal_members',
        'proposal_documents', 'proposal_budgets', 'tracker_numbers', 'evaluation_types',
        'evaluation_categories', 'evaluation_questions', 'review_assignments',
        'review_scores', 'defence_sessions', 'threshold_settings', 'awards',
        'complaints', 'similarity_scores', 'notification_preferences',
        'workflow_logs', 'audit_logs', 'roles', 'permissions', 'model_has_roles',
    ];

    foreach ($expected as $table) {
        expect(Schema::connection('mysql')->hasTable($table))->toBeTrue("Table '{$table}' does not exist");
    }
});

test('workflow_logs_has_no_updated_at_column', function () {
    expect(Schema::connection('mysql')->hasColumn('workflow_logs', 'updated_at'))->toBeFalse();
});

test('audit_logs_has_no_updated_at_column', function () {
    expect(Schema::connection('mysql')->hasColumn('audit_logs', 'updated_at'))->toBeFalse();
});

test('tracker_numbers_has_unique_constraint_on_category_and_year', function () {
    $indexes = collect(DB::connection('mysql')->select("SHOW INDEX FROM tracker_numbers WHERE Non_unique = 0 AND Column_name IN ('category', 'academic_year')"));

    $uniqueIndexNames = $indexes->pluck('Key_name')->unique()->filter(fn ($n) => $n !== 'PRIMARY')->values();

    expect($uniqueIndexNames)->toHaveCount(1);

    $indexName = $uniqueIndexNames->first();
    $columns = $indexes->where('Key_name', $indexName)->sortBy('Seq_in_index')->pluck('Column_name')->values()->toArray();

    expect($columns)->toBe(['category', 'academic_year']);
});

test('proposal_members_has_no_soft_deletes', function () {
    $traits = class_uses_recursive(\App\Models\ProposalMember::class);

    expect($traits)->not->toContain(\Illuminate\Database\Eloquent\SoftDeletes::class);
});
