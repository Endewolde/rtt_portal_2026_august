<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProposalAiScore extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'clarity_score',
        'feasibility_score',
        'budget_alignment_score',
        'innovation_score',
        'completeness_score',
        'overall_score',
        'strengths',
        'weaknesses',
        'recommendations',
        'summary',
        'model_used',
        'status',
        'error_message',
        'scored_at',
    ];

    protected $casts = [
        'clarity_score' => 'integer',
        'feasibility_score' => 'integer',
        'budget_alignment_score' => 'integer',
        'innovation_score' => 'integer',
        'completeness_score' => 'integer',
        'overall_score' => 'integer',
        'scored_at' => 'datetime',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }
}
