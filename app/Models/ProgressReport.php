<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A PI's periodic (every N months) progress report on a funded project; the last
 * period is the final report. See App\Services\ProgressReportService.
 */
class ProgressReport extends Model
{
    use HasUuids;

    public const STATUS_DUE = 'due';

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_REVISION = 'revision_requested';

    protected $fillable = [
        'proposal_id', 'period_number', 'period_start', 'period_end', 'due_date', 'is_final', 'status',
        'summary', 'achievements', 'challenges', 'next_steps', 'percent_complete', 'budget_spent',
        'milestone_updates', 'attachment_path', 'attachment_name', 'submitted_by', 'submitted_at',
        'reviewed_by', 'reviewed_at', 'review_notes', 'due_reminder_sent_at', 'overdue_reminder_sent_at',
    ];

    protected $hidden = ['attachment_path'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'due_date' => 'date',
            'is_final' => 'boolean',
            'percent_complete' => 'integer',
            'budget_spent' => 'decimal:2',
            'milestone_updates' => 'array',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'due_reminder_sent_at' => 'datetime',
            'overdue_reminder_sent_at' => 'datetime',
        ];
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /** The PI can (re)submit while it is due or sent back for revision. */
    public function isOpenForSubmission(): bool
    {
        return in_array($this->status, [self::STATUS_DUE, self::STATUS_REVISION], true);
    }

    public function isOverdue(): bool
    {
        return $this->isOpenForSubmission() && $this->due_date->isPast() && ! $this->due_date->isToday();
    }
}
