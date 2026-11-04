<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConferenceAbstractReview extends Model
{
    use HasUuids;

    protected $fillable = [
        'abstract_id', 'reviewer_id', 'score', 'criteria_scores', 'comments', 'confidential_comments',
        'recommendation', 'submitted_at', 'conflict_declared_at', 'conflict_reason',
    ];

    protected $casts = [
        'score' => 'integer',
        'criteria_scores' => 'array',
        'submitted_at' => 'datetime',
        'conflict_declared_at' => 'datetime',
    ];

    public function abstract(): BelongsTo
    {
        return $this->belongsTo(ConferenceAbstract::class, 'abstract_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
