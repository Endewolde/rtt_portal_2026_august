<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class DefenceSession extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'scheduled_date',
        'scheduled_time',
        'venue',
        'online_link',
        'status',
        'scheduled_by',
        'final_score',
        'score_deadline_extended_until',
        'deadline_reminder_sent_at',
        'flagged_incomplete_at',
        'notes',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'final_score' => 'float',
        'score_deadline_extended_until' => 'datetime',
        'deadline_reminder_sent_at' => 'datetime',
        'flagged_incomplete_at' => 'datetime',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function scheduledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scheduled_by');
    }

    public function deadlineExtensions(): HasMany
    {
        return $this->hasMany(DefenceDeadlineExtension::class)->latest();
    }

    /** Scores can be submitted from the start of the defence day. */
    public function scoringOpensAt(): Carbon
    {
        return $this->scheduled_date->copy()->startOfDay();
    }

    /** End of the day after the defence — e.g. a Monday defence is due by Tuesday 23:59. */
    public function defaultScoreDeadline(): Carbon
    {
        return $this->scheduled_date->copy()->addDay()->endOfDay();
    }

    /** The default deadline, or the approved extension that replaced it. */
    public function scoreDeadline(): Carbon
    {
        return $this->score_deadline_extended_until?->copy() ?? $this->defaultScoreDeadline();
    }
}
