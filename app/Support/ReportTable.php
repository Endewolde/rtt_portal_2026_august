<?php

namespace App\Support;

/** Turns any report result into rows and labelled columns — for Excel, PDF and email. */
class ReportTable
{
    /**
     * Normalize any report result shape into a flat [rows, fieldNames] pair.
     * Handles the report-builder's {dimensions, metrics, rows} shape as well as the
     * plain list-of-rows shape every other report type returns.
     *
     * @return array{0: array<int, array<string, mixed>>, 1: string[]}
     */
    public static function tabulate(array $result): array
    {
        if (isset($result['rows']) && is_array($result['rows'])) {
            $fields = array_merge($result['dimensions'] ?? [], $result['metrics'] ?? []);

            return [$result['rows'], $fields];
        }

        if (array_is_list($result) && ! empty($result) && is_array($result[0])) {
            // Ids are there for drill-down on screen, not for the spreadsheet.
            return [$result, array_values(array_filter(array_keys($result[0]), fn ($f) => ! str_ends_with($f, '_id')))];
        }

        return [[], []];
    }

    public const COLUMN_LABELS = [
        'college' => 'College', 'college_name' => 'College', 'category' => 'Category',
        'status' => 'Status', 'academic_year' => 'Academic Year', 'level' => 'Level',
        'complaint_type' => 'Complaint Type', 'stage' => 'Stage', 'code' => 'Code',
        'count' => 'Count', 'total' => 'Total', 'total_proposals' => 'Total Proposals',
        'total_submitted' => 'Total Submitted', 'total_accepted' => 'Total Accepted',
        'funded' => 'Funded', 'funded_count' => 'Funded', 'rejected' => 'Rejected',
        'rejected_count' => 'Rejected', 'accepted' => 'Accepted',
        'submitted' => 'Submitted', 'validated' => 'Validated', 'under_review' => 'Under Review',
        'archived' => 'Archived', 'unresolved' => 'Unresolved', 'resolved' => 'Resolved',
        'dismissed' => 'Dismissed', 'level_1_college' => 'Level 1 (College)',
        'level_2_officer' => 'Level 2 (Officer)', 'avg_resolution_days' => 'Avg Resolution (days)',
        'approval_rate_percent' => 'Approval Rate (%)', 'rejection_rate_percent' => 'Rejection Rate (%)',
        'pass_rate' => 'Pass Rate (%)', 'reviewer_name' => 'Reviewer', 'total_assigned' => 'Total Assigned',
        'pending' => 'Pending', 'average_days_to_review' => 'Avg Days to Review',
        'submitted_count' => 'Submitted', 'avg_days_to_review' => 'Avg Days to Review',
        'proposal_title' => 'Proposal Title', 'tracker_number' => 'Tracker Number',
        'allocated' => 'Allocated', 'disbursed' => 'Disbursed', 'settled' => 'Settled',
        'utilization_percent' => 'Utilization (%)', 'outputs_produced' => 'Outputs Produced',
        'publications_count' => 'Publications', 'total_awarded' => 'Total Awarded',
        'proposals_submitted' => 'Proposals Submitted', 'proposals_accepted' => 'Proposals Accepted',
        'stage_label' => 'Stage',
        'sdg' => 'SDG', 'goal' => 'Goal', 'proposals' => 'Proposals', 'awarded' => 'Awarded',
    ];

    public static function label(string $key): string
    {
        // The organisation's own words for its units and reporting year.
        return match ($key) {
            'college', 'college_name' => Terms::college(),
            'department', 'department_name' => Terms::department(),
            'academic_year' => Terms::academicYear(),
            default => self::COLUMN_LABELS[$key] ?? ucwords(str_replace('_', ' ', $key)),
        };
    }
}
