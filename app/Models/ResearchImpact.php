<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResearchImpact extends Model
{
    protected $fillable = [
        'proposal_id',
        'recorded_by',
        'type',
        'title',
        'authors',
        'journal_or_venue',
        'year',
        'doi_or_url',
        'impact_factor',
        'description',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'year' => 'integer',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
