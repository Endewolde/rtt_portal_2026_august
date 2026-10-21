<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalApprovalReport extends Model
{
    use HasUuids;

    /**
     * Issues a college officer can report. Keep in sync with
     * resources/js/lib/approvalReportIssues.js.
     *
     * @var array<string, string>
     */
    public const ISSUE_TYPES = [
        'not_anonymous' => 'Not anonymous — author identity revealed',
        'already_ongoing' => 'Already ongoing — the project is already running',
        'duplicate_or_funded' => 'Duplicate or already funded proposal',
        'plagiarism' => 'Plagiarism or high similarity',
        'ineligible_team' => 'PI or team not eligible',
        'outside_call_scope' => "Outside the call's scope or category",
        'incomplete_documents' => 'Missing or incomplete documents',
        'budget_noncompliant' => 'Budget not compliant with the call',
        'ethical_clearance' => 'Ethical clearance missing or invalid',
        'format_noncompliant' => 'Template or format not followed',
        'conflict_of_interest' => 'Conflict of interest in the approval',
        'other' => 'Other',
    ];

    protected $fillable = [
        'proposal_id', 'reported_by', 'issue_type', 'reason',
        'status', 'outcome', 'returned_from_status', 'reviewed_by', 'reviewed_at', 'withdrawn_at', 'resolution_notes',
    ];

    protected $casts = ['reviewed_at' => 'datetime', 'withdrawn_at' => 'datetime'];

    protected $appends = ['issue_label', 'summary'];

    public function getIssueLabelAttribute(): ?string
    {
        return self::ISSUE_TYPES[$this->issue_type] ?? null;
    }

    /** One line for notes and notifications: "Issue — details", or whichever exists. */
    public function getSummaryAttribute(): string
    {
        $label = $this->issue_type && $this->issue_type !== 'other' ? $this->issue_label : null;
        $details = trim((string) $this->reason);

        return match (true) {
            $label && $details !== '' => "{$label} — {$details}",
            (bool) $label => $label,
            default => $details,
        };
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
