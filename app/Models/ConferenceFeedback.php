<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An attendee's rating of the conference after it, one per registration. */
class ConferenceFeedback extends Model
{
    use HasUuids;

    protected $table = 'conference_feedback';

    protected $fillable = ['conference_id', 'registration_id', 'rating', 'would_recommend', 'liked', 'improve'];

    protected $casts = ['rating' => 'integer', 'would_recommend' => 'boolean'];

    public function registration(): BelongsTo
    {
        return $this->belongsTo(ConferenceRegistration::class, 'registration_id');
    }
}
