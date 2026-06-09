<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompletionWorkshop extends Model
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
        'evaluator_remarks',
        'presentation_files',
        'photos',
        'videos',
        'final_report_path',
    ];

    protected $casts = [
        'scheduled_date'     => 'date',
        'final_score'        => 'decimal:2',
        'presentation_files' => 'array',
        'photos'             => 'array',
        'videos'             => 'array',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function scheduledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scheduled_by');
    }
}
