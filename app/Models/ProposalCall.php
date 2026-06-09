<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProposalCall extends Model
{
    use HasUuids, SoftDeletes;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'academic_year',
        'category',
        'title',
        'slug',
        'description',
        'eligibility',
        'guidelines_file',
        'start_date',
        'end_date',
        'status',
        'is_open',
        'max_proposals_per_pi',
        'created_by',
    ];

    protected $casts = [
        'is_open'    => 'boolean',
        'start_date' => 'datetime',
        'end_date'   => 'datetime',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active')->where('is_open', true);
    }

    public function getCountdownSecondsAttribute(): int
    {
        $end = $this->end_date;
        if (! $end || $end->isPast()) {
            return 0;
        }

        return (int) now()->diffInSeconds($end, false);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function proposals(): HasMany
    {
        return $this->hasMany(Proposal::class);
    }
}
