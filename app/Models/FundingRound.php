<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A call's funding decisions (or one college's share of them), prepared together and published together. */
class FundingRound extends Model
{
    use HasUuids;

    protected $fillable = [
        'proposal_call_id', 'college_id', 'status', 'notes', 'created_by', 'published_by', 'published_at',
        'budget_at_publish', 'committed_before',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'budget_at_publish' => 'decimal:2',
            'committed_before' => 'decimal:2',
        ];
    }

    public function call(): BelongsTo
    {
        return $this->belongsTo(ProposalCall::class, 'proposal_call_id');
    }

    /** The college the round covers; null when it covers the whole call. */
    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(FundingRoundItem::class)->orderBy('rank');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }
}
