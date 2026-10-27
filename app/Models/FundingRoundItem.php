<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One proposal's place and outcome in a funding round. */
class FundingRoundItem extends Model
{
    use HasUuids;

    public const DECISIONS = ['pending', 'fund', 'reserve', 'reject'];

    protected $fillable = [
        'funding_round_id', 'proposal_id', 'decision', 'amount', 'reason_code', 'reason', 'remarks',
        'rank', 'score', 'score_max', 'requested', 'promoted_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'score' => 'decimal:2',
            'score_max' => 'decimal:2',
            'requested' => 'decimal:2',
            'promoted_at' => 'datetime',
        ];
    }

    public function round(): BelongsTo
    {
        return $this->belongsTo(FundingRound::class, 'funding_round_id');
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }
}
