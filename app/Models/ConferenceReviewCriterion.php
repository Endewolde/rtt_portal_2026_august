<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One line of a conference's review rubric (e.g. Originality), scored 1–5 and weighted. */
class ConferenceReviewCriterion extends Model
{
    use HasUuids;

    protected $table = 'conference_review_criteria';

    protected $fillable = ['conference_id', 'name', 'description', 'weight', 'sort_order'];

    protected $casts = ['weight' => 'integer'];

    public function conference(): BelongsTo
    {
        return $this->belongsTo(Conference::class);
    }
}
