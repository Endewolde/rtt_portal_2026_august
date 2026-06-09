<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MidtermEvaluation extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'evaluation_date',
        'evaluation_time',
        'venue',
        'status',
        'scheduled_by',
        'progress_summary',
        'financial_utilization_percentage',
        'publications_count',
        'challenges',
        'milestones_achieved',
        'milestones_missed',
        'progress_report_path',
        'financial_report_path',
        'progress_score',
        'college_officer_comments',
        'recommendation',
        'scored_by',
        'scored_at',
    ];

    protected $casts = [
        'evaluation_date'                  => 'date',
        'financial_utilization_percentage' => 'decimal:2',
        'publications_count'               => 'integer',
        'progress_score'                   => 'decimal:2',
        'scored_at'                        => 'datetime',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function scheduledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scheduled_by');
    }

    public function scoredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scored_by');
    }
}
