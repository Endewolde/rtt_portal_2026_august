<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SimilarityScore extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'similar_proposal_id',
        'score',
        'flagged',
        'checked_at',
    ];

    protected $casts = [
        'score'      => 'float',
        'flagged'    => 'boolean',
        'checked_at' => 'datetime',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function similarProposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class, 'similar_proposal_id');
    }
}
