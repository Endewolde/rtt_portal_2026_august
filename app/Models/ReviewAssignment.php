<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReviewAssignment extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'proposal_id',
        'reviewer_id',
        'evaluation_type_id',
        'assigned_by',
        'status',
        'assigned_at',
        'due_date',
        'submitted_at',
        'is_external',
    ];

    protected $casts = [
        'assigned_at'  => 'datetime',
        'submitted_at' => 'datetime',
        'is_external'  => 'boolean',
    ];

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function evaluationType(): BelongsTo
    {
        return $this->belongsTo(EvaluationType::class);
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function scores(): HasMany
    {
        return $this->hasMany(ReviewScore::class);
    }
}
