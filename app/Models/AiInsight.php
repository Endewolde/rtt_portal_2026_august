<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Saved AI advice about a proposal (see ProposalAiCoachService and ReviewSummaryService). */
class AiInsight extends Model
{
    use HasUuids;

    public const TYPE_COACH = 'writing_coach';

    public const TYPE_REVIEW_SUMMARY = 'review_summary';

    protected $fillable = ['proposal_id', 'type', 'requested_by', 'result', 'model', 'fingerprint'];

    protected function casts(): array
    {
        return ['result' => 'array'];
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(Proposal::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
